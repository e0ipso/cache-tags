// @flow

import type { DebouncerInterface, InflightStore } from '../types/common';

/**
 * A map of commands in-flight to debounce.
 *
 * @var {InflightStore}
 */
const inflight: InflightStore = new Map();

class Debouncer implements DebouncerInterface {
  /**
   * The store that resolves the commands.
   *
   * @var {Object}
   */
  backend: Object;

  /**
   * @inheritDoc
   */
  constructor(backend: Object): void {
    this.backend = backend;
  }

  /**
   * @inheritDoc
   */
  debounce(command: string, ...args: Array<any>): Promise<*> {
    const key = `${command}::${args.map(a => JSON.stringify(a)).join(':')}`;
    const debounced: ?Promise<*> = inflight.get(key);
    if (debounced) {
      return debounced;
    }
    const promise = this.backend[command](...args)
      .then(result => {
        // Remove from in-flight when it resolves and return the results.
        inflight.delete(key);
        return result;
      })
      .catch(err => {
        inflight.delete(key);
        throw err;
      });
    // Add the promise to the in-flight map.
    inflight.set(key, promise);
    return promise;
  }
}

module.exports = Debouncer;
