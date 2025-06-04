// CHANGELOG: [2025-06-04] - Created InsomniaConfigBody and InsomniaConfigBodyParam classes

/**
 * Represents body parameters for form-urlencoded requests
 */
export class InsomniaConfigBodyParam {
  public readonly id: string;
  public readonly name: string;
  public readonly value: string;
  public readonly disabled: boolean;

  constructor(data: {
    id: string;
    name: string;
    value: string;
    disabled: boolean;
  }) {
    this.id = data.id;
    this.name = data.name;
    this.value = data.value;
    this.disabled = data.disabled;
  }

  /**
   * Checks if this parameter is active (not disabled)
   * @returns True if the parameter is active
   * @example
   * ```typescript
   * const param = new InsomniaConfigBodyParam({ id: "1", name: "username", value: "john", disabled: false });
   * console.log(param.isActive()); // true
   * ```
   */
  isActive(): boolean {
    return !this.disabled;
  }
}

/**
 * Represents request body configuration
 */
export class InsomniaConfigBody {
  public readonly mimeType: string;
  public readonly text?: string;
  public readonly params?: InsomniaConfigBodyParam[];

  constructor(data: {
    mimeType: string;
    text?: string;
    params?: any[];
  }) {
    this.mimeType = data.mimeType;
    this.text = data.text;
    this.params = data.params?.map(param => new InsomniaConfigBodyParam(param));
  }

  /**
   * Checks if this body contains JSON content
   * @returns True if the body is JSON
   * @example
   * ```typescript
   * const body = new InsomniaConfigBody({ mimeType: "application/json", text: '{"key": "value"}' });
   * console.log(body.isJson()); // true
   * ```
   */
  isJson(): boolean {
    return this.mimeType === 'application/json';
  }

  /**
   * Checks if this body contains form data
   * @returns True if the body is form-urlencoded
   * @example
   * ```typescript
   * const body = new InsomniaConfigBody({ mimeType: "application/x-www-form-urlencoded" });
   * console.log(body.isFormData()); // true
   * ```
   */
  isFormData(): boolean {
    return this.mimeType === 'application/x-www-form-urlencoded';
  }

  /**
   * Gets active parameters (non-disabled)
   * @returns Array of active parameters
   * @example
   * ```typescript
   * const body = new InsomniaConfigBody({ 
   *   mimeType: "application/x-www-form-urlencoded", 
   *   params: [{ id: "1", name: "active", value: "yes", disabled: false }]
   * });
   * console.log(body.getActiveParams().length); // 1
   * ```
   */
  getActiveParams(): InsomniaConfigBodyParam[] {
    return this.params?.filter(param => param.isActive()) || [];
  }
}