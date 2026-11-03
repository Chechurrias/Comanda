import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authSession } from '../../core/auth-session';
import { supabase } from '../../core/api/supabase';
import { cloudDbService } from '../../core/cloud-db';
import { deviceStorage } from '../../core/storage';

export default function RestaurantCustomizationScreen() {
  const router = useRouter();
  const [tenantId, setTenantId] = useState('');
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [restaurantName, setRestaurantName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedLogo, setSelectedLogo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const user = await authSession.getUser();
      if (!user?.tenant_id || user.role !== 'restaurant_admin') {
        Alert.alert('Acceso denegado', 'Solo el administrador del restaurante puede cambiar estos datos.');
        router.replace('/');
        return;
      }

      setSessionUser(user);
      setTenantId(user.tenant_id);
      const profile = await cloudDbService.getRestaurantProfile(user.tenant_id);
      setRestaurantName(profile.name || '');
      setLogoUrl(profile.logo_url || null);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo cargar la configuración del restaurante.');
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const timer = setTimeout(() => void loadProfile(), 0);
    return () => clearTimeout(timer);
  }, [loadProfile]);

  const chooseLogo = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });

    if (!result.canceled) setSelectedLogo(result.assets[0]);
  };

  const saveProfile = async () => {
    if (!tenantId || !sessionUser) return;
    if (!restaurantName.trim()) {
      Alert.alert('Nombre requerido', 'Ingresa el nombre del restaurante.');
      return;
    }

    setIsSaving(true);
    try {
      let nextLogoUrl = logoUrl;
      if (selectedLogo) {
        const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
        if (selectedLogo.mimeType && !supportedTypes.includes(selectedLogo.mimeType)) {
          throw new Error('El formato de imagen no es compatible. Usa JPG, PNG, WebP o HEIC.');
        }
        const contentType = selectedLogo.mimeType === 'image/png'
          ? 'image/png'
          : selectedLogo.mimeType === 'image/webp'
            ? 'image/webp'
            : selectedLogo.mimeType === 'image/heic'
              ? 'image/heic'
              : selectedLogo.mimeType === 'image/heif'
                ? 'image/heif'
                : 'image/jpeg';
        const extension = contentType.split('/')[1];
        const objectPath = `${tenantId}/restaurant-logo.${extension}`;
        const response = await fetch(selectedLogo.uri);
        if (!response.ok) throw new Error('No se pudo leer el archivo de imagen seleccionado.');
        const imageData = await response.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from('restaurant-logos')
          .upload(objectPath, imageData, { contentType, upsert: true });
        if (uploadError) throw uploadError;

        const publicUrl = supabase.storage.from('restaurant-logos').getPublicUrl(objectPath).data.publicUrl;
        nextLogoUrl = `${publicUrl}?v=${Date.now()}`;
      }

      const profile = await cloudDbService.updateRestaurantProfile(
        tenantId,
        restaurantName,
        nextLogoUrl,
      );
      setRestaurantName(profile.name);
      setLogoUrl(profile.logo_url);
      setSelectedLogo(null);
      await deviceStorage.set('restaurant_name', profile.name);
      await authSession.saveUser({ ...sessionUser, restaurant_name: profile.name });
      setSessionUser((current: any) => ({ ...current, restaurant_name: profile.name }));
      Alert.alert('Configuración guardada', 'El nombre y logotipo del restaurante se actualizaron.');
    } catch (error: any) {
      Alert.alert('No se pudo guardar', error.message || 'Verifica tu conexión e inténtalo de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const previewUri = selectedLogo?.uri || logoUrl;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Personalización</Text>
        <Text style={styles.subtitle}>Actualiza la información que identifica a tu restaurante.</Text>

        {isLoading ? (
          <ActivityIndicator size="large" color="#818cf8" style={styles.loader} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.label}>Nombre del restaurante</Text>
            <TextInput
              style={styles.input}
              value={restaurantName}
              onChangeText={setRestaurantName}
              placeholder="Nombre del negocio"
              placeholderTextColor="#64748b"
              maxLength={150}
              editable={!isSaving}
            />

            <Text style={styles.label}>Logotipo</Text>
            <View style={styles.logoPreview}>
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={styles.logoImage} resizeMode="contain" />
              ) : (
                <Text style={styles.logoPlaceholder}>Sin logotipo</Text>
              )}
            </View>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void chooseLogo()} disabled={isSaving}>
              <Text style={styles.secondaryButtonText}>Elegir imagen</Text>
            </TouchableOpacity>
            <Text style={styles.helpText}>JPG, PNG, WebP o HEIC; máximo 2 MB.</Text>

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.disabledButton]}
              onPress={() => void saveProfile()}
              disabled={isSaving}
            >
              <Text style={styles.saveButtonText}>{isSaving ? 'Guardando...' : 'Guardar cambios'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  content: { padding: 20, flexGrow: 1 },
  backButton: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#1e293b', borderRadius: 8 },
  backButtonText: { color: '#cbd5e1', fontWeight: '700' },
  title: { color: '#ffffff', fontSize: 24, fontWeight: '800', marginTop: 26 },
  subtitle: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginTop: 6, marginBottom: 20 },
  loader: { marginTop: 40 },
  card: { backgroundColor: '#0f172a', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#1e293b' },
  label: { color: '#cbd5e1', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: { backgroundColor: '#020617', color: '#ffffff', borderColor: '#334155', borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 20 },
  logoPreview: { width: 150, height: 150, alignSelf: 'center', backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 14, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage: { width: '100%', height: '100%' },
  logoPlaceholder: { color: '#64748b', fontSize: 13 },
  secondaryButton: { alignSelf: 'center', backgroundColor: '#1e293b', borderRadius: 10, paddingHorizontal: 18, paddingVertical: 10, marginTop: 12 },
  secondaryButtonText: { color: '#c7d2fe', fontWeight: '700' },
  helpText: { textAlign: 'center', color: '#64748b', fontSize: 11, marginTop: 8, marginBottom: 22 },
  saveButton: { backgroundColor: '#4f46e5', paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  disabledButton: { opacity: 0.6 },
  saveButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
});
