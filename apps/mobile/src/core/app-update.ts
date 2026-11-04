import * as Application from 'expo-application';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { supabase } from './api/supabase';

export type AppUpdate = {
  version: string;
  apkUrl: string;
  releaseNotes: string | null;
  isMandatory: boolean;
};

function parseVersion(version: string): number[] {
  if (!/^\d+(?:\.\d+)*$/.test(version)) {
    throw new Error(`Versión no válida en app_versions: ${version}`);
  }

  return version.split('.').map(Number);
}

function compareVersions(left: string, right: string): number {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  const partCount = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < partCount; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }

  return 0;
}

function validateApkUrl(apkUrl: string): string {
  let url: URL;
  try {
    url = new URL(apkUrl);
  } catch {
    throw new Error('La URL de actualización no es válida.');
  }

  if (url.protocol !== 'https:' || !url.pathname.toLowerCase().endsWith('.apk')) {
    throw new Error('La actualización debe apuntar a un archivo APK servido por HTTPS.');
  }

  return url.toString();
}

export async function getAvailableAppUpdate(): Promise<AppUpdate | null> {
  if (Platform.OS !== 'android') return null;

  const installedVersion = Application.nativeApplicationVersion;
  if (!installedVersion) {
    throw new Error('No se pudo obtener la versión instalada de la aplicación.');
  }

  const { data, error } = await supabase
    .from('app_versions')
    .select('latest_version, min_version, apk_url, release_notes, is_mandatory')
    .eq('platform', 'android')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const latestVersion = String(data.latest_version);
  const minimumVersion = String(data.min_version);
  const currentIsBelowMinimum = compareVersions(installedVersion, minimumVersion) < 0;
  if (compareVersions(latestVersion, minimumVersion) < 0) {
    throw new Error('La versión mínima publicada supera la última versión disponible.');
  }
  if (compareVersions(installedVersion, latestVersion) >= 0) return null;

  return {
    version: latestVersion,
    apkUrl: validateApkUrl(String(data.apk_url)),
    releaseNotes: typeof data.release_notes === 'string' ? data.release_notes : null,
    isMandatory: Boolean(data.is_mandatory) || currentIsBelowMinimum,
  };
}

export async function downloadAppUpdate(
  update: AppUpdate,
  onProgress: (percentage: number | null) => void
): Promise<File> {
  const url = validateApkUrl(update.apkUrl);
  const destination = new File(new Directory(Paths.cache), `comanda-${update.version}.apk`);

  return File.downloadFileAsync(url, destination, {
    idempotent: true,
    onProgress: ({ bytesWritten, totalBytes }) => {
      onProgress(totalBytes > 0 ? Math.min(100, Math.round((bytesWritten / totalBytes) * 100)) : null);
    },
  });
}
