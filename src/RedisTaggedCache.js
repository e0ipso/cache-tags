// @flow

const _ = require('lodash');
const Promise = require('bluebird');

const TaggedCache = require('./TaggedCache');

/**
 * Forever reference key.
 *
 * @var string
 */
const REFERENCE_KEY_FOREVER = 'forever_ref';
/**
 * Standard reference key.
 *
 * @var string
 */
const REFERENCE_KEY_STANDARD = 'standard_ref';

class RedisTaggedCache extends TaggedCache {
  /**
   * Store an item in the cache.
   *
   * Takes the same arguments as ioredis set calls.
   *
   * @param {key} key
   * @param {*} value
   * @param {Array<*>} additionalArgs
   * @return {void}
   */
  set(key: string, value: any, ...additionalArgs: [string, number]): Promise<void> {
    const reference = additionalArgs[1] ? REFERENCE_KEY_STANDARD : REFERENCE_KEY_FOREVER;
    return this.tags.getNamespace()
      .then(namespace => Promise.all([
        this.pushKeys(namespace, key, reference),
        super.set(key, value, ...additionalArgs),
      ]));
  }

  /**
   * Increment the value of an item in the cache.
   *
   * @param {string} key
   * @param {mixed} value
   * @return {Promise<void>}
   */
  increment(key: string, value: any = 1): Promise<void> {
    const nsPromise = this.tags.getNamespace();
    return Promise.all([
      nsPromise.then(namespace => this.pushStandardKeys(namespace, key)),
      super.increment(key, value),
    ]);
  }

  /**
   * Decrement the value of an item in the cache.
   *
   * @param {string} key
   * @param {mixed} value
   * @return {Promise<void>}
   */
  decrement(key: string, value: any = 1): Promise<void> {
    const nsPromise = this.tags.getNamespace();
    return Promise.all([
      nsPromise.then(namespace => this.pushStandardKeys(namespace, key)),
      super.decrement(key, value),
    ]);
  }

  /**
   * Remove all items from the cache.
   *
   * @return {Promise<void>}
   */
  flush(): Promise<void> {
    return Promise.all([
      this.deleteForeverKeys(),
      this.deleteStandardKeys(),
    ])
      .then(() => super.flush());
  }

  /**
   * Lists all the entries for the provided tags.
   *
   * @return {Promise<Array>}
   */
  list(): Promise<Array<any>> {
    const tagIdCorrespondence = [];
    return this.tags.tagIds().then(tagIds => {
      const refTypes = [REFERENCE_KEY_FOREVER, REFERENCE_KEY_STANDARD];
      const tagRefs: { [string]: Array<string> } = tagIds
        .reduce((carry, tagId) => Object.assign(
          carry,
          { [tagId]: refTypes.map(ref => this.referenceKey(tagId, ref)) }
        ), {});
      const prms = Object.keys(tagRefs).map(tagId => Promise.all(
        tagRefs[tagId].map(tagRef => {
          tagIdCorrespondence.push(tagId);
          return this.store.smembers(tagRef);
        }
      )));
      return Promise.all(prms);
    })
      .then((res: Array<Array<Array<string>>>) => res
        .map(its => its.reduce((c, i) => [...c, ...i], [])))
      .then((res: Array<Array<string>>) => {
        if (!res.length) {
          return [];
        }
        const intersection = res.length > 1
          ? _.intersection(...res)
          : res[0];
        return intersection
          // We need to remove the Redis prefix. This is un-ideal.
          .map(key => key.replace(new RegExp(`^${this.store.options.keyPrefix}`), ''));
      })
      .then(keys => {
        if (!keys.length) {
          return [];
        }
        return Promise.all(keys.map(key => this.store.get(key)));
      });
  }

  /**
   * Store standard key references into store.
   *
   * @param {string} namespace
   * @param {string} key
   * @return {Promise<void>}
   */
  pushStandardKeys(namespace: string, key: string): Promise<void> {
    return this.pushKeys(namespace, key, REFERENCE_KEY_STANDARD);
  }

  /**
   * Store forever key references into store.
   *
   * @param {string} namespace
   * @param {string} key
   * @return {Promise<void>}
   */
  pushForeverKeys(namespace: string, key: string): Promise<void> {
    return this.pushKeys(namespace, key, REFERENCE_KEY_FOREVER);
  }

  /**
   * Store a reference to the cache key against the reference key.
   *
   * @param {string} namespace
   * @param {string} key
   * @param {string} reference
   * @return {Promise<void>}
   */
  pushKeys(namespace: string, key: string, reference: string): Promise<void> {
    const fullKey = this.store.options.keyPrefix
      ? `${this.store.options.keyPrefix}${key}`
      : key;
    return Promise.all(namespace.split('|').map(segment => {
      const referenceKey = this.referenceKey(segment, reference);
      return this.store.sadd(referenceKey, fullKey);
    }));
  }

  /**
   * Delete all of the items that were stored forever.
   *
   * @return {Promise<void>}
   */
  deleteForeverKeys(): Promise<void> {
    return this.deleteKeysByReference(REFERENCE_KEY_FOREVER);
  }

  /**
   * Delete all standard items.
   *
   * @return {Promise<void>}
   */
  deleteStandardKeys(): Promise<void> {
    return this.deleteKeysByReference(REFERENCE_KEY_STANDARD);
  }

  /**
   * Find and delete all of the items that were stored against a reference.
   *
   * @param {string} reference
   * @return {void}
   */
  deleteKeysByReference(reference: string): Promise<void> {
    return this.tags.getNamespace()
      .then(namespace => {
        const referenceKeys = namespace.split('|')
          .map(segment => this.referenceKey(segment, reference));
        const promises = referenceKeys.map(referenceKey =>
          this.deleteValues(referenceKey));
        return Promise.all(promises).then(() => referenceKeys);
      })
      .then((referenceKeys) => Promise.all(
        referenceKeys.map(rk => this.store.del(rk))
      ))
      .then(() => {});
  }

  /**
   * Delete item keys that have been stored against a reference.
   *
   * @param {string} referenceKey
   * @return {Promise<void>}
   */
  deleteValues(referenceKey: string): Promise<void> {
    return this.store.smembers(referenceKey)
      .then(members => Array.from(new Set(members)))
      .then(members => {
        if (!members.length) {
          return Promise.resolve();
        }
        return Promise.map(
          _.chunk(members, 1000),
          (chunk) => Promise.all(chunk.map(item => this.store.del(item))),
          { concurrency: 100 }
        );
      })
      .then(() => {});
  }

  /**
   * Get the reference key for the segment.
   *
   * @param {string} segment
   * @param {string} suffix
   * @return {string}
   */
  referenceKey(segment: string, suffix: string): string {
    return `${this.tagPrefix}${segment}:${suffix}`;
  }
}

module.exports = RedisTaggedCache;
