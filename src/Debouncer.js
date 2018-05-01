// @flow

import type { DebouncerInterface, InflightStore } from '../types/common';

class Debouncer implements DebouncerInterface {
  /**
   * A map of commands in-flight to debounce.
   *
   * @var {InflightStore}
   */
  inflight: InflightStore;

  /**
   * The store that resolves the commands.
   *
   * @var {Object}
   */
  backend: Object;

  /**
   * @inheritDoc
   */
  constructor(inflight: InflightStore, backend: Object): void {
    this.inflight = inflight;
    this.backend = backend;
  }

  /**
   * @inheritDoc
   */
  debounce(command: string, ...args: Array<any>): Promise<*> {
    const key = [command, args];
    const debounced: ?Promise<*> = this.inflight.get(key);
    if (debounced) {
      return debounced;
    }
    const promise = this.backend[command](...args).then((result) => {
      // Remove from in-flight when it resolves and return the results.
      this.inflight.delete(key);
      return result;
    });
    // Add the promise to the in-flight map.
    this.inflight.set(key, promise);
    return promise;
  }
}

module.exports = Debouncer;
