import * as cfnspec from '@aws-cdk/cfnspec';
import { CodeMaker } from 'codemaker';


/**
 * Generate default prop sets for canned metric
 *
 * We don't generate `cloudwatch.Metric` objects directly (because we can't
 * guarantee that all packages already properly depend on
 * `@aws-cdk/aws-cloudwatch`).
 *
 * Instead, we generate functions that return the set of properties that should
 * be passed to a `cloudwatch.Metric` to construct it.
 */
export class CannedMetricsGenerator {
  private readonly code = new CodeMaker({ indentationLevel: 2 });
  private readonly outputFile: string;

  constructor(moduleName: string, private readonly namespace: string) {
    this.outputFile = `${moduleName}-canned-metrics.generated.ts`;
    this.code.openFile(this.outputFile);

    this.code.line(`// Copyright 2012-${new Date().getFullYear()} Amazon.com, Inc. or its affiliates. All Rights Reserved.`);
    this.code.line();
    this.code.line('/* eslint-disable max-len */ // This is generated code - line lengths are difficult to control');
  }

  public generate(): boolean {
    const namespaces = groupByNamespace(cfnspec.cannedMetricsForService(this.namespace));
    for (const [namespace, metrics] of Object.entries(namespaces)) {
      this.code.openBlock(`export class ${namespace}Metrics`);

      for (const metric of metrics) {
        const functionName = this.functionName(metric);

        // Anonymous type for the dimensions (TypeScript only)
        const allDimsType = metric.dimensions.map(dimensionsType).join(' | ');

        this.code.openBlock(`public static ${functionName}(dimensions: ${allDimsType})`);
        this.code.line('return {');
        this.code.line(`  namespace: '${metric.namespace}',`);
        this.code.line(`  metricName: '${metric.metricName}',`);
        this.code.line('  dimensions,');
        this.code.line(`  statistic: '${metric.defaultStat}',`);
        this.code.line('};');
        this.code.closeBlock();
      }

      this.code.closeBlock();
    }

    return Object.keys(namespaces).length > 0;
  }

  /**
   * Saves the generated file.
   */
  public async save(dir: string): Promise<string[]> {
    this.code.closeFile(this.outputFile);
    return this.code.save(dir);
  }

  private functionName(metric: cfnspec.CannedServiceMetric) {
    return makeIdentifier(lcfirst(`${metric.metricName}${metric.defaultStat}`));
  }
}

function lcfirst(s: string) {
  return s.substr(0, 1).toLowerCase() + s.substr(1);
}

/**
 * If not a valid identifier, prefix with a '_'
 */
function makeIdentifier(s: string) {
  return s.match(/^[a-zA-Z_]/) ? s : `_${s}`;
}

/**
 * Return an anonymous TypeScript type that would accept the given dimensions
 */
function dimensionsType(dims: string[]) {
  return `{ ${dims.map(d => `${d}: string`).join(', ')} }`;
}

function groupByNamespace(metrics: cfnspec.CannedServiceMetric[]): Record<string, cfnspec.CannedServiceMetric[]> {
  const ret: Record<string, cfnspec.CannedServiceMetric[]> = {};
  for (const metric of metrics) {
    // Always starts with 'AWS/'
    const [, namespace] = metric.namespace.split('/');
    (ret[namespace] ?? (ret[namespace] = [])).push(metric);
  }
  return ret;
}