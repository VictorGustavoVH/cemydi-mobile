#include "RNSScreenRemovalListener.h"
#include <react/renderer/mounting/ShadowViewMutation.h>
#include <utility>
using namespace facebook::react;

uint64_t RNSScreenRemovalListener::setListener(
    std::function<void(int)> &&listenerFunction) {
  std::lock_guard<std::mutex> lock(listenerMutex_);
  listenerFunction_ = std::move(listenerFunction);
  return ++currentToken_;
}

void RNSScreenRemovalListener::clearListener(uint64_t token) {
  std::lock_guard<std::mutex> lock(listenerMutex_);
  if (token == currentToken_) {
    listenerFunction_ = nullptr;
  }
}

std::optional<MountingTransaction> RNSScreenRemovalListener::pullTransaction(
    SurfaceId surfaceId,
    MountingTransaction::Number transactionNumber,
    const TransactionTelemetry &telemetry,
    ShadowViewMutationList mutations) const {
  // Copia con el mutex adquirido e invoca fuera de él: la llamada JNI no debe
  // retener un bloqueo que también necesita el hilo del módulo.
  std::function<void(int)> listener;
  {
    std::lock_guard<std::mutex> lock(listenerMutex_);
    listener = listenerFunction_;
  }

  if (!listener) {
    // Entre la liberación del módulo y su próxima instalación, conserva
    // la transacción sin modificaciones.
    return MountingTransaction{
        surfaceId, transactionNumber, std::move(mutations), telemetry};
  }

  for (const ShadowViewMutation &mutation : mutations) {
    // Si se usa RNSModalScreen en Android, debe añadirse aquí.
    if (mutation.type == ShadowViewMutation::Type::Remove &&
        mutation.oldChildShadowView.componentName != nullptr &&
        std::strcmp(mutation.oldChildShadowView.componentName, "RNSScreen") ==
            0) {
      // Invoca el listener aunque la pantalla no pertenezca a RNSScreenStack:
      // desde RN 0.78 falta esa información aquí. NativeProxy filtra después.
      listener(mutation.oldChildShadowView.tag);
    }
  }

  return MountingTransaction{
      surfaceId, transactionNumber, std::move(mutations), telemetry};
}

bool RNSScreenRemovalListener::shouldOverridePullTransaction() const {
  return true;
}
