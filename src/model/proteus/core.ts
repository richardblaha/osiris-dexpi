/**
 * Core registries and parsing context for Proteus SerDes.
 */

import type { ValidationIssue } from '../../common/types';

export type ErrorSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface ParseError {
  severity: ErrorSeverity;
  message: string;
  proteusId?: string;
  tag?: string;
}

export class ObjectRegistry {
  private byProteusId = new Map<string, any>();
  private byId = new Map<string, any>();

  public register(obj: any, proteusId?: string): void {
    if (obj.id) {
      this.byId.set(obj.id, obj);
    }
    const pid = proteusId || obj.proteusId;
    if (pid) {
      this.byProteusId.set(pid, obj);
    }
  }

  public getByProteusId<T = any>(proteusId: string): T | undefined {
    return this.byProteusId.get(proteusId);
  }

  public getById<T = any>(id: string): T | undefined {
    return this.byId.get(id);
  }

  public has(idOrProteusId: string): boolean {
    return this.byId.has(idOrProteusId) || this.byProteusId.has(idOrProteusId);
  }

  public getAllObjects(): any[] {
    return Array.from(this.byId.values());
  }
}

export class ErrorRegistry {
  private errors: ParseError[] = [];

  public register(
    severity: ErrorSeverity,
    message: string,
    proteusId?: string,
    tag?: string
  ): void {
    this.errors.push({ severity, message, proteusId, tag });
  }

  public getErrors(severity?: ErrorSeverity): ParseError[] {
    if (severity) {
      return this.errors.filter((e) => e.severity === severity);
    }
    return [...this.errors];
  }

  public toValidationIssues(): ValidationIssue[] {
    return this.errors.map((e) => ({
      severity: e.severity === 'critical' ? 'error' : e.severity,
      code: `PROTEUS_${e.severity.toUpperCase()}`,
      message: e.message,
      elementId: e.proteusId,
      elementType: e.tag,
    }));
  }
}

export class ParseContext {
  public elementStack: string[] = [];
  public idStack: string[] = [];
  public objectRegistry = new ObjectRegistry();
  public errorRegistry = new ErrorRegistry();

  public push(tag: string, id?: string): void {
    this.elementStack.push(tag);
    if (id) this.idStack.push(id);
  }

  public pop(id?: string): void {
    this.elementStack.pop();
    if (id) {
      const idx = this.idStack.lastIndexOf(id);
      if (idx >= 0) this.idStack.splice(idx, 1);
    }
  }

  public currentTag(): string | undefined {
    return this.elementStack[this.elementStack.length - 1];
  }

  public currentId(): string | undefined {
    return this.idStack[this.idStack.length - 1];
  }
}

