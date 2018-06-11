module.exports = {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          node: true,
        },
        shippedProposals: true,
      },
    ],
    '@babel/preset-flow',
  ],
};
