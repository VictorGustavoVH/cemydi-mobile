#include <fbjni/fbjni.h>
#include <react/fabric/Binding.h>
#include <react/renderer/scheduler/Scheduler.h>

#include <memory>
#include <string>

#include "NativeProxy.h"

using namespace facebook;
using namespace react;

namespace rnscreens {

namespace {
// Conserva el listener durante todo el proceso para evitar carreras cuando
// varios hilos invocan nativeAddMutationsListener() durante el arranque.
// La inicialización estática local es segura entre hilos y evita referencias
// liberadas en la lista de delegados, que solo admite añadir entradas. Detalles:
// https://github.com/software-mansion/react-native-screens/pull/4413
const std::shared_ptr<RNSScreenRemovalListener> &removalListener() {
  static const std::shared_ptr<RNSScreenRemovalListener> instance =
      std::make_shared<RNSScreenRemovalListener>();
  return instance;
}
} // espacio de nombres

NativeProxy::NativeProxy(jni::alias_ref<NativeProxy::javaobject> jThis)
    : javaPart_(jni::make_global(jThis)) {}

void NativeProxy::registerNatives() {
  registerHybrid(
      {makeNativeMethod("initHybrid", NativeProxy::initHybrid),
       makeNativeMethod(
           "nativeAddMutationsListener",
           NativeProxy::nativeAddMutationsListener),
       makeNativeMethod(
           "cleanupExpiredMountingCoordinators",
           NativeProxy::cleanupExpiredMountingCoordinators),
       makeNativeMethod("invalidateNative", NativeProxy::invalidateNative)});
}

void NativeProxy::nativeAddMutationsListener(
    jni::alias_ref<facebook::react::JFabricUIManager::javaobject>
        fabricUIManager) {
  auto uiManager =
      fabricUIManager->getBinding()->getScheduler()->getUIManager();

  {
    // Captura la referencia global por valor: el listener sobrevive a NativeProxy.
    // La lectura anterior de javaPart_ competía con invalidateNative(). El mutex
    // protege la copia y mantiene el token asociado a la última instalación.
    std::lock_guard<std::mutex> lock(installMutex_);
    removalListenerToken_ =
        removalListener()->setListener([javaPart = javaPart_](int tag) {
          static const auto method =
              javaPart->getClass()->getMethod<void(jint)>(
                  "notifyScreenRemoved");
          method(javaPart, tag);
        });
  }

  cleanupExpiredMountingCoordinators();

  uiManager->getShadowTreeRegistry().enumerate(
      [this](const facebook::react::ShadowTree &shadowTree, bool &stop) {
        if (auto coordinator = shadowTree.getMountingCoordinator()) {
          addMountingCoordinatorIfNeeded(coordinator);
        }
      });
}

void NativeProxy::cleanupExpiredMountingCoordinators() {
  std::lock_guard<std::mutex> lock(coordinatorsMutex_);

  coordinatorsWithMountingOverrides_.erase(
      std::remove_if(
          coordinatorsWithMountingOverrides_.begin(),
          coordinatorsWithMountingOverrides_.end(),
          [](const std::weak_ptr<const facebook::react::MountingCoordinator>
                 &weakPtr) { return weakPtr.expired(); }),
      coordinatorsWithMountingOverrides_.end());
}

void NativeProxy::addMountingCoordinatorIfNeeded(
    const std::shared_ptr<const facebook::react::MountingCoordinator>
        &coordinator) {
  std::lock_guard<std::mutex> lock(coordinatorsMutex_);

  bool wasRegistered = std::ranges::any_of(
      coordinatorsWithMountingOverrides_,
      [&coordinator](
          const std::weak_ptr<const facebook::react::MountingCoordinator>
              &weakPtr) {
        auto existing = weakPtr.lock();
        return existing && existing.get() == coordinator.get();
      });

  if (!wasRegistered) {
    coordinator->setMountingOverrideDelegate(removalListener());
    coordinatorsWithMountingOverrides_.push_back(coordinator);
  }
}

jni::local_ref<NativeProxy::jhybriddata> NativeProxy::initHybrid(
    jni::alias_ref<jhybridobject> jThis) {
  return makeCxxInstance(jThis);
}

void NativeProxy::invalidateNative() {
  // Desactiva el listener antes de liberar el objeto híbrido y su referencia JNI.
  // El mutex evita tokens obsoletos y que javaPart_ se anule durante la captura.
  std::lock_guard<std::mutex> lock(installMutex_);
  removalListener()->clearListener(removalListenerToken_);
  javaPart_ = nullptr;
}

} // espacio de nombres rnscreens
