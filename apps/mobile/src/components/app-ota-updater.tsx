import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { Platform } from 'react-native';

export function AppOtaUpdater() {
  useEffect(() => {
    if (Platform.OS === 'web' || !Updates.isEnabled) return;

    void (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (!update.isAvailable) return;

        const result = await Updates.fetchUpdateAsync();
        if (result.isNew) await Updates.reloadAsync();
      } catch (error) {
        console.warn('[AppUpdate] No se pudo descargar la actualización OTA:', error);
      }
    })();
  }, []);

  return null;
}
