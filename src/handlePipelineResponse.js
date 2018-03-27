// @flow

/**
 * Handles a pipeline response from the Redis back-end.
 *
 * @param {Array<[?Error, T]>} res
 * @returns {(Error|(Error|T)[])[]}
 */
function handlePipelineResponse<T>(res: Array<[?Error, T]>): Array<T> {
  const errors = res.map(i => i[0]).filter(i => i);
  if (errors.length) {
    throw new Error(errors);
  }
  return res.map(i => i[1]);
}

module.exports = handlePipelineResponse;
