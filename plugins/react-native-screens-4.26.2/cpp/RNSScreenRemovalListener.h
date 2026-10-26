#pragma once

#include <react/renderer/componentregistry/ComponentDescriptorFactory.h>
#include <react/renderer/mounting/MountingOverrideDelegate.h>
#include <react/renderer/mounting/ShadowView.h>

#include <cstdint>
#include <functional>
#include <mutex>

using namespace facebook::react;

struct RNSScreenRemovalListener : public MountingOverrideDelegate {
  RNSScreenRemovalListener() = default;

  // RN no ofrece removeMountingOverrideDelegate: la instancia vive durante todo
  // el proceso y reemplaza su callback. El token evita que un proxy obsoleto
  // borre el listener instalado por otro más reciente.
  // Referencia: https://github.com/software-mansion/react-native-screens/pull/4413
  uint64_t setListener(std::function<void(int)> &&listenerFunction);
  void clearListener(uint64_t token);

  bool shouldOverridePullTransaction() const override;
  std::optional<MountingTransaction> pullTransaction(
      SurfaceId surfaceId,
      MountingTransaction::Number number,
      const TransactionTelemetry &telemetry,
      ShadowViewMutationList mutations) const override;

 private:
  mutable std::mutex listenerMutex_;
  std::function<void(int)> listenerFunction_;
  uint64_t currentToken_{0};
};
