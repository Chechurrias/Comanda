import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../core/api/supabase';
import { authSession } from '../../core/auth-session';
import { deviceStorage } from '../../core/storage';

const RESTAURANT_HERO_IMAGE = require('../../../assets/images/watermarked_img_16088531156329847148.jpg');

WebBrowser.maybeCompleteAuthSession();

export default function AdminLoginScreen() {
  const router = useRouter();

  // Estados Formulario Simple
  const [restaurantName, setRestaurantName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | 'email' | null>(null);

  // Selector desplegable (Iniciar Sesión vs Crear Restaurante)
  const [showEmailSection, setShowEmailSection] = useState(false);
  const [emailMode, setEmailMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    let isMounted = true;

    const loadRememberedEmail = async () => {
      try {
        const savedEmail = await deviceStorage.get('admin_login_email');
        if (isMounted && savedEmail) {
          setEmail(savedEmail);
          setShowEmailSection(true);
        }
      } catch (error) {
        console.warn('[AdminLogin] No se pudo recuperar el correo guardado:', error);
      }
    };

    void loadRememberedEmail();
    return () => {
      isMounted = false;
    };
  }, []);

  const rememberEmail = async (emailAddress: string) => {
    const normalizedEmail = emailAddress.trim().toLowerCase();
    if (!normalizedEmail) return;

    try {
      await deviceStorage.set('admin_login_email', normalizedEmail);
    } catch (error) {
      console.warn('[AdminLogin] No se pudo guardar el correo:', error);
    }
  };

  // RESOLVER Y GUARDAR SESIÓN DE ADMINISTRADOR DE FORMA SEGURA
  const completeAdminSession = async (user: any) => {
    try {
      setIsLoading(true);
      if (user.email) await rememberEmail(user.email);

      const { data, error } = await supabase.rpc('get_my_admin_session');

      if (error) throw error;

      if (data && data.success) {
        await authSession.saveUser(data);
        router.replace('/(admin)/dashboard');
        return;
      }

      Alert.alert(
        'Bienvenido a Comanda Cloud',
        `Hola ${user.user_metadata?.full_name || user.email}. Para comenzar tu primera vez, ingresa el nombre de tu restaurante.`,
        [{ text: 'Completar', onPress: () => {
          setEmail(user.email || '');
          setAdminName(user.user_metadata?.full_name || '');
          setEmailMode('signup');
          setShowEmailSection(true);
        }}]
      );
    } catch (err: any) {
      Alert.alert('Acceso no autorizado', err.message || 'No se pudo vincular tu perfil de administrador.');
    } finally {
      setIsLoading(false);
    }
  };

  // 1. INICIO CON GOOGLE / APPLE
  const handleOAuthLogin = async (provider: 'google' | 'apple') => {
    try {
      setIsLoading(true);
      setLoadingProvider(provider);

      const redirectUrl = Linking.createURL('/');

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          const urlObj = new URL(result.url);
          const params = new URLSearchParams(urlObj.hash.substring(1) || urlObj.search);
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');

          if (accessToken && refreshToken) {
            const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionErr) throw sessionErr;
            if (sessionData?.user) {
              await completeAdminSession(sessionData.user);
              return;
            }
          }
        }
      }
    } catch (err: any) {
      Alert.alert(`Error con ${provider === 'google' ? 'Google' : 'Apple'}`, err.message);
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  // 2. INICIAR SESIÓN CON CORREO
  const handleEmailLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa tu correo y contraseña.');
      return;
    }

    setIsLoading(true);
    setLoadingProvider('email');
    try {
      await rememberEmail(email);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      if (error || !data.user) {
        throw new Error(error?.message || 'Correo o contraseña incorrectos.');
      }

      await completeAdminSession(data.user);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  // 3. REGISTRAR RESTAURANTE
  const handleRegisterNewRestaurant = async () => {
    if (!restaurantName.trim() || !adminName.trim() || !email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Ingresa el nombre del restaurante, tu nombre, correo y contraseña.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Contraseña corta', 'La contraseña debe tener mínimo 6 caracteres.');
      return;
    }

    setIsLoading(true);
    setLoadingProvider('email');
    try {
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password.trim(),
        options: {
          data: { 
            full_name: adminName.trim(),
            restaurant_name: restaurantName.trim() 
          }
        }
      });

      if (signUpErr) throw signUpErr;
      const authUserId = signUpData.user?.id;

      if (!authUserId) {
        throw new Error('No se pudo generar la cuenta. Si ya estás registrado, pulsa en "Iniciar Sesión".');
      }

      const { data: rpcResult, error: rpcErr } = await supabase.rpc('register_admin_restaurant', {
        p_auth_user_id: authUserId,
        p_email: email.trim().toLowerCase(),
        p_restaurant_name: restaurantName.trim(),
        p_admin_name: adminName.trim(),
      });

      if (rpcErr) throw rpcErr;
      if (!rpcResult || !rpcResult.success) {
        throw new Error(rpcResult?.error || 'No se pudo crear el restaurante.');
      }

      await authSession.saveUser(rpcResult);
      await rememberEmail(email);

      Alert.alert(
        '¡Restaurante Creado!',
        `Bienvenido ${rpcResult.full_name}.\nEl código para tus meseros es: "${rpcResult.tenant_slug}".`,
        [{ text: 'Entrar a Administrar', onPress: () => router.replace('/(admin)/dashboard') }]
      );

    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setIsLoading(false);
      setLoadingProvider(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Barra Superior */}
      <View style={styles.topNav}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.badgeTop}>Administrador Cloud</Text>
      </View>

      {/* SCROLLVIEW AJUSTADO PARA EVITAR QUE EL TECLADO OCULTE LOS CAMPOS */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        overScrollMode="always"
      >
        {/* Encabezado con Imagen */}
        <View style={styles.header}>
          <View style={styles.imageContainer}>
            <Image source={RESTAURANT_HERO_IMAGE} style={styles.heroImage} resizeMode="cover" />
          </View>
          <Text style={styles.title}>Acceso a Caja</Text>
          <Text style={styles.subtitle}>Gestiona tu restaurante y supervisa la sala</Text>
        </View>

        {/* MÉTODOS PRINCIPALES: GMAIL (GOOGLE) Y APPLE */}
        {/* <View style={styles.socialButtonsBox}>
          <TouchableOpacity
            style={styles.btnGoogle}
            activeOpacity={0.8}
            onPress={() => handleOAuthLogin('google')}
            disabled={isLoading}
          >
            {loadingProvider === 'google' ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <View style={styles.btnSocialContent}>
                <Text style={styles.googleIconText}>G</Text>
                <Text style={styles.btnGoogleText}>Continuar con Google (Gmail)</Text>
              </View>
            )}
          </TouchableOpacity>

          {(Platform.OS === 'ios' || Platform.OS === 'android') && (
            <TouchableOpacity
              style={styles.btnApple}
              activeOpacity={0.8}
              onPress={() => handleOAuthLogin('apple')}
              disabled={isLoading}
            >
              {loadingProvider === 'apple' ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <View style={styles.btnSocialContent}>
                  <Text style={styles.appleIconText}></Text>
                  <Text style={styles.btnAppleText}>Continuar con Apple</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* SECCIÓN DESPLEGABLE: INGRESO O REGISTRO SIMPLIFICADO */}
        <View style={styles.accordionContainer}>
          <TouchableOpacity
            style={styles.accordionToggle}
            activeOpacity={0.7}
            onPress={() => setShowEmailSection(prev => !prev)}
          >
            <Text style={styles.accordionToggleText}>
              {showEmailSection ? '▲ Ocultar opciones de correo' : '▼ Acceder o registrar restaurante con correo'}
            </Text>
          </TouchableOpacity>

          {showEmailSection && (
            <View style={styles.dropdownForm}>
              {/* Selector Iniciar Sesión vs Crear Restaurante */}
              <View style={styles.tabSelector}>
                <TouchableOpacity
                  style={[styles.tabBtn, emailMode === 'login' && styles.tabBtnActive]}
                  onPress={() => setEmailMode('login')}
                >
                  <Text style={[styles.tabBtnText, emailMode === 'login' && styles.tabBtnTextActive]}>
                    Iniciar Sesión
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.tabBtn, emailMode === 'signup' && styles.tabBtnActive]}
                  onPress={() => setEmailMode('signup')}
                >
                  <Text style={[styles.tabBtnText, emailMode === 'signup' && styles.tabBtnTextActive]}>
                    Crear Restaurante
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Formulario Reducido */}
              <View style={styles.formFields}>
                {emailMode === 'signup' && (
                  <>
                    <View>
                      <Text style={styles.inputLabel}>Nombre del Restaurante *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: Pizzería Roma"
                        placeholderTextColor="#64748b"
                        value={restaurantName}
                        onChangeText={setRestaurantName}
                      />
                      <Text style={styles.helperText}>El código para tus meseros se generará automáticamente.</Text>
                    </View>

                    {/* Campo de Nombre del Administrador */}
                    <View>
                      <Text style={styles.inputLabel}>Tu Nombre y Apellido (Administrador) *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Ej: Carlos Gómez"
                        placeholderTextColor="#64748b"
                        value={adminName}
                        onChangeText={setAdminName}
                      />
                    </View>
                  </>
                )}

                <View>
                  <Text style={styles.inputLabel}>Correo Electrónico *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="admin@restaurante.com"
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <View>
                  <Text style={styles.inputLabel}>Contraseña *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={emailMode === 'signup' ? 'Mínimo 6 caracteres' : '••••••••••••'}
                    placeholderTextColor="#64748b"
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={emailMode === 'login' ? handleEmailLogin : handleRegisterNewRestaurant}
                  disabled={isLoading}
                >
                  {loadingProvider === 'email' ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.submitBtnText}>
                      {emailMode === 'login' ? 'Ingresar a Caja' : 'Crear Restaurante'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  topNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
  backBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#0f172a', borderRadius: 8, borderWidth: 1, borderColor: '#1e293b' },
  backBtnText: { color: '#94a3b8', fontSize: 12, fontWeight: 'bold' },
  badgeTop: { color: '#818cf8', fontSize: 12, fontWeight: 'bold', backgroundColor: '#312e81', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },

  // 👇 Padding inferior amplio para permitir scroll completo con el teclado abierto
  scrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 250 },

  header: { alignItems: 'center', marginVertical: 8 },
  imageContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#4f46e5',
    marginBottom: 8,
    backgroundColor: '#0f172a',
  },
  heroImage: { width: '100%', height: '100%' },
  title: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
  subtitle: { color: '#94a3b8', fontSize: 13, marginTop: 4, textAlign: 'center' },

  socialButtonsBox: { width: '100%', gap: 10, marginTop: 14 },
  btnGoogle: { backgroundColor: '#ffffff', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  btnApple: { backgroundColor: '#000000', paddingVertical: 14, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#334155' },
  btnSocialContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  googleIconText: { color: '#ea4335', fontSize: 18, fontWeight: '900' },
  appleIconText: { color: '#ffffff', fontSize: 20 },
  btnGoogleText: { color: '#0f172a', fontSize: 14, fontWeight: 'bold' },
  btnAppleText: { color: '#ffffff', fontSize: 14, fontWeight: 'bold' },

  accordionContainer: { marginTop: 20, width: '100%' },
  accordionToggle: { paddingVertical: 10, alignItems: 'center' },
  accordionToggleText: { color: '#818cf8', fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },

  dropdownForm: {
    backgroundColor: '#0f172a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginTop: 8,
  },
  tabSelector: { flexDirection: 'row', backgroundColor: '#020617', borderRadius: 10, padding: 3, marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#1e1b4b' },
  tabBtnText: { color: '#64748b', fontSize: 12, fontWeight: '600' },
  tabBtnTextActive: { color: '#818cf8', fontWeight: 'bold' },

  formFields: { gap: 10 },
  inputLabel: { color: '#cbd5e1', fontSize: 11, fontWeight: '600', marginBottom: 3 },
  input: { backgroundColor: '#020617', borderWidth: 1, borderColor: '#334155', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#ffffff', fontSize: 14 },
  helperText: { color: '#64748b', fontSize: 10, marginTop: 3 },
  submitBtn: { backgroundColor: '#4f46e5', paddingVertical: 13, borderRadius: 10, alignItems: 'center', marginTop: 6 },
  submitBtnText: { color: '#ffffff', fontSize: 13, fontWeight: 'bold' },
});