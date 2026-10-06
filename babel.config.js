module.exports = function (api) {
  api.cache(true);

  // En Jest no se aplica NativeWind: los tests validan comportamiento y texto,
  // no estilos, y el transform de nativewind rompe los jest.mock en TSX.
  if (process.env.NODE_ENV === 'test') {
    return { presets: ['babel-preset-expo'] };
  }

  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
  };
};
