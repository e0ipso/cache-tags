// @flow

const _ = require('lodash');
const { map: promiseMap } = require('bluebird');

const TaggedCache = require('./TaggedCache');

type TagRefs = Array<string>;

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
  set(
    key: string,
    value: any,
    ...additionalArgs: [string, number]
  ): Promise<void> {
    return this.tags
      .getNamespace()
      .then(namespace =>
        Promise.all([
          this.pushKeys(namespace, key),
          super.set(key, value, ...additionalArgs),
        ])
      )
      .then(() => {});
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
      nsPromise.then(namespace => this.pushKeys(namespace, key)),
      super.increment(key, value),
    ]).then(() => {});
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
      nsPromise.then(namespace => this.pushKeys(namespace, key)),
      super.decrement(key, value),
    ]).then(() => {});
  }

  /**
   * Remove all items from the cache.
   *
   * @return {Promise<void>}
   */
  flush(): Promise<void> {
    return this.deleteKeys().then(() => super.flush());
  }

  /**
   * Delete cache data tagged with a set of tags.
   *
   * @return {Promise<void>}
   *   Resolves when done.
   */
  deleteWithTags(): Promise<void> {
    return this.fetchTaggedKeysByTag()
      .then(res =>
        Promise.all([Promise.resolve(res), this.fetchTaggedKeys(res)])
      )
      .then(([res, keysToDelete]) => {
        const tagIds = Object.keys(res);
        const pairs = _.flatten(
          tagIds.map(tagId => {
            const tagRef = this.referenceKey(tagId);
            return res[tagId].map(key => [tagRef, key]);
          })
        );
        const deletablePairs = pairs.filter(
          pair => keysToDelete.indexOf(pair[1]) !== -1
        );
        const tagPromises = deletablePairs.map(([setKey, setMember]) =>
          this.store.srem(setKey, setMember)
        );
        // Delete the cache entries themselves.
        const dataPromise = this.deleteMultiple(keysToDelete);
        return Promise.all([...tagPromises, dataPromise]);
      });
  }

  /**
   * Lists all the entries for the provided tags.
   *
   * @return {Promise<Array>}
   */
  list(): Promise<Array<any>> {
    return this.fetchTaggedKeys()
      .then(keys => this.getMultiple(keys))
      .then(res => Object.keys(res).map(k => res[k]));
  }

  /**
   * Store a reference to the cache key against the reference key.
   *
   * @param {string} namespace
   * @param {string} key
   * @param {string} reference
   * @return {Promise<void>}
   */
  pushKeys(namespace: string, key: string): Promise<void> {
    const fullKey = this.store.options.keyPrefix
      ? `${this.store.options.keyPrefix}${key}`
      : key;
    const referenceKeys = namespace
      .split('|')
      .map(segment => this.referenceKey(segment));
    return Promise.all(
      referenceKeys.map(referenceKey => this.store.sadd(referenceKey, fullKey))
    ).then(() => {});
  }

  /**
   * Find and delete all of the items that were stored against a reference.
   *
   * @param {string} reference
   * @return {void}
   */
  deleteKeys(): Promise<void> {
    return this.tags
      .getNamespace()
      .then(namespace => {
        const referenceKeys = namespace
          .split('|')
          .map(segment => this.referenceKey(segment));
        return this.deleteValues(referenceKeys).then(() => referenceKeys);
      })
      .then(referenceKeys =>
        Promise.all(referenceKeys.map(rk => this.store.del(rk)))
      )
      .then(() => {});
  }

  /**
   * Delete item keys that have been stored against a reference.
   *
   * @param {TagRefs} referenceKeys
   * @return {Promise<void>}
   */
  deleteValues(referenceKeys: TagRefs): Promise<void> {
    return Promise.all(
      referenceKeys.map(referenceKey => this.getAllMembers(referenceKey))
    )
      .then(batches => _.flatten(batches))
      .then(members => Array.from(new Set(members)))
      .then(members => {
        if (!members.length) {
          return Promise.resolve();
        }
        return promiseMap(
          _.chunk(members, 1000),
          chunk => Promise.all(chunk.map(item => this.store.del(item))),
          { concurrency: 100 }
        );
      })
      .then(() => {});
  }

  /**
   * Get the reference key for the segment.
   *
   * @param {string} segment
   * @return {string}
   */
  referenceKey(segment: string): string {
    return `${this.tagPrefix}${segment}`;
  }

  /**
   * Utility function to get the cache entries associated with tags.
   *
   * @return {Promise<Array<[string, TagRefs]>>}
   *   An internal structure to reuse on intermediate processes.
   *
   * @private
   */
  fetchTaggedKeysByTag(): Promise<{ [string]: TagRefs }> {
    return this.tags.tagIds().then(tagIds => {
      const prms = tagIds.map(tagId =>
        this.getAllMembers(this.referenceKey(tagId))
      );
      return Promise.all(prms).then(res => _.zipObject(tagIds, res));
    });
  }

  /**
   * Fetch the keys for the provided combination of tags.
   *
   * @param {Array<[string, TagRefs]>} [taggedKeysByTag]
   *   You can pass this optionally if you calculated it earlier.
   *
   * @return {Promise<(Array<string>|*[])[]>}
   *   The list of keys related to the tag set.
   *
   * @protected
   */
  fetchTaggedKeys(
    taggedKeysByTag: ?{ [string]: TagRefs }
  ): Promise<Array<string>> {
    const promise = taggedKeysByTag
      ? Promise.resolve(taggedKeysByTag)
      : this.fetchTaggedKeysByTag();
    return promise
      .then((res): Array<TagRefs> => Object.keys(res).map(k => res[k]))
      .then((res: Array<TagRefs>) => {
        if (!res.length) {
          return [];
        }
        const intersection =
          res.length > 1 ? _.intersection(..._.uniq(res)) : res[0];
        return (
          intersection
            // We need to remove the Redis prefix. This is un-ideal.
            .map(key =>
              key.replace(new RegExp(`^${this.store.options.keyPrefix}`), '')
            )
        );
      });
  }

  /**
   * Gets all the members of a set in a performant manner.
   *
   * This is potentially a bit less consistent than using SMEMBERS, but it is
   * also faster.
   *
   * @param {string} setKey
   *   The set key.
   * @param {number} cursor
   *   The pagination cursor.
   * @param {string[]} carry
   *   The accumulated elements in the set. This is for internal tracking.
   *
   * @return {Promise<*[]>}
   *   The promise of all the members of a set.
   */
  getAllMembers(
    setKey: string,
    cursor: number = 0,
    carry: Array<string> = []
  ): Promise<Array<*>> {
    return this.debounce('sscan', setKey, cursor).then(
      ([newCursor, results]) => {
        const output = [...carry, ...results];
        // Stop recursing when the server returns 0 as the new cursor.
        return newCursor > 0
          ? this.getAllMembers(setKey, newCursor, output)
          : output;
      }
    );
  }
}

module.exports = RedisTaggedCache;
