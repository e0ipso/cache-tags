// @flow

import type Redis from 'ioredis';

export interface TagSetInterface {
  /**
   * Create a new TagSet instance.
   *
   * @param  {Redis} store
   * @param  {string[]}  names
   */
  constructor(store: Redis, names: Array<string>): void;

  /**
   * Reset all tags in the set.
   *
   * @return {Promise<void>}
   */
  reset(): Promise<void>;

  /**
   * Initialize the tag and return the new tag identifier.
   *
   * @param {string} name
   * @return {Promise<string>}
   */
  initTag(name: string): Promise<string>;

  /**
   * Get a unique namespace that changes when any of the tags are flushed.
   *
   * @return {Promise<string>}
   */
  getNamespace(): Promise<string>;

  /**
   * Get the unique tag identifier for a given tag.
   *
   * @param {string} name
   * @return {Promise<string>}
   */
  tagId(name: string): Promise<string>;

  /**
   * Get an array of tag identifiers for all of the tags in the set.
   *
   * @return {Promise<string[]>}
   */
  tagIds(): Promise<Array<string>>;

  /**
   * Get the tag identifier key for a given tag.
   *
   * @param {string} name
   * @return {string}
   */
  tagKey(name: string): string;

  /**
   * Get all of the tag names in the set.
   *
   * @return {string[]}
   */
  getNames(): Array<string>;
}
