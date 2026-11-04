import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { downloadAppUpdate, getAvailableAppUpdate, type AppUpdate } from '../core/app-update';

export function AppUpdatePrompt() {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    let isMounted = true;
    void getAvailableAppUpdate()
      .then((availableUpdate) => {
        if (isMounted) setUpdate(availableUpdate);
      })
      .catch((error: unknown) => {
        console.warn('[AppUpdate] No se pudo consultar la versión disponible:', error);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const startUpdate = async () => {
    if (!update || isDownloading) return;

    setIsDownloading(true);
    setErrorMessage(null);
    setDownloadProgress(0);

    try {
      const apkFile = await downloadAppUpdate(update, setDownloadProgress);
      if (!apkFile.exists || !apkFile.size) {
        throw new Error('El archivo APK descargado está vacío o no está disponible.');
      }

      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: apkFile.contentUri,
        flags: 1,
        type: 'application/vnd.android.package-archive',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[AppUpdate] No se pudo descargar o instalar la actualización:', error);
      setErrorMessage(message);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  };

  const openInstallPermissionSettings = async () => {
    try {
      await IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
        { data: `package:${Application.applicationId}` }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[AppUpdate] No se pudieron abrir los ajustes de instalación:', error);
      setErrorMessage(message);
    }
  };

  if (!update) return null;

  return (
    <Modal
      animationType="fade"
      transparent
      visible
      onRequestClose={() => {
        if (!update.isMandatory && !isDownloading) setUpdate(null);
      }}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.icon}>
            <Ionicons name="cloud-download-outline" size={28} color="#25B9E8" />
          </View>
          <Text style={styles.title}>Nueva versión disponible</Text>
          <Text style={styles.version}>Comanda Cloud {update.version}</Text>
          <Text style={styles.description}>
            {update.releaseNotes?.trim() || 'Actualiza la aplicación para continuar con la versión más reciente.'}
          </Text>

          {isDownloading ? (
            <View style={styles.progressContainer}>
              <ActivityIndicator color="#25B9E8" />
              <Text style={styles.progressText}>
                {downloadProgress === null
                  ? 'Descargando actualización…'
                  : `Descargando actualización… ${downloadProgress}%`}
              </Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <Pressable onPress={openInstallPermissionSettings}>
                <Text style={styles.settingsLink}>Abrir ajustes de instalación</Text>
              </Pressable>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isDownloading}
            onPress={startUpdate}
            style={[styles.primaryButton, isDownloading && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {errorMessage ? 'Reintentar actualización' : 'Descargar e instalar'}
            </Text>
          </Pressable>

          {!update.isMandatory ? (
            <Pressable
              accessibilityRole="button"
              disabled={isDownloading}
              onPress={() => setUpdate(null)}
              style={styles.secondaryButton}
            >
              <Text style={styles.secondaryButtonText}>Más tarde</Text>
            </Pressable>
          ) : (
            <Text style={styles.mandatoryNote}>Esta actualización es necesaria para continuar.</Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(2, 6, 23, 0.72)',
  },
  card: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(37, 185, 232, 0.12)',
    marginBottom: 18,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 21,
    fontWeight: '700',
  },
  version: {
    color: '#38BDF8',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 6,
  },
  description: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 14,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  progressText: {
    color: '#CBD5E1',
    fontSize: 13,
  },
  errorContainer: {
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 13,
    lineHeight: 19,
  },
  settingsLink: {
    color: '#7DD3FC',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#0EA5E9',
    marginTop: 22,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  secondaryButtonText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  mandatoryNote: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 14,
  },
});
