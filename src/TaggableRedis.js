// @flow

const Redis = require('ioredis');
const RedisTaggedCache = require('./RedisTaggedCache');
const TagSet = require('./TagSet');
const Redlock = require('redlock');

class TaggableRedis extends Redis {
  tags(names: Array<string>, redlock: Redlock) {
    const theRedlock = redlock || new Redlock([this], {
      // the expected clock drift; for more details
      // see http://redis.io/topics/distlock
      driftFactor: 0.01, // time in ms
      // the max number of times Redlock will attempt
      // to lock a resource before erroring
      retryCount:  10,
      // the time in ms between attempts
      retryDelay:  200, // time in ms
      // the max time in ms randomly added to retries
      // to improve performance under high contention
      // see https://www.awsarchitectureblog.com/2015/03/backoff.html
      retryJitter:  200 // time in ms
    });
    theRedlock.on('clientError', (err) => {
      this.emit('clientError', err);
    });
    return new RedisTaggedCache(this, new TagSet(this, names, theRedlock));
  }
};

class TaggableCluster extends Redis.Cluster {
  tags(names: Array<string>, redlock: Redlock) {
    const connections = Object.keys(this.connectionPool.nodes.master)
      .map(k => this.connectionPool.nodes.all[k]);
    const theRedlock = redlock || new Redlock(connections, {
      // the expected clock drift; for more details
      // see http://redis.io/topics/distlock
      driftFactor: 0.01, // time in ms
      // the max number of times Redlock will attempt
      // to lock a resource before erroring
      retryCount:  10,
      // the time in ms between attempts
      retryDelay:  200, // time in ms
      // the max time in ms randomly added to retries
      // to improve performance under high contention
      // see https://www.awsarchitectureblog.com/2015/03/backoff.html
      retryJitter:  200 // time in ms
    });
    theRedlock.on('clientError', (err) => {
      this.emit('clientError', err);
    });
    return new RedisTaggedCache(this, new TagSet(this, names, theRedlock));
  }
};
TaggableRedis.Cluster = TaggableCluster;

module.exports = TaggableRedis;
