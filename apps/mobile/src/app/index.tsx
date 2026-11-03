import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authSession } from '../core/auth-session';
import { deviceStorage } from '../core/storage';

// =====================================================
// COMANDA CLOUD — DASHBOARD RÁPIDO
// =====================================================

const COLORS = {
  background: '#090B17',
  primary: '#6845FF',
  primaryLight: '#8065FF',
  success: '#10B981',
  white: '#FFFFFF',
  textSecondary: '#D1D5E7',
  textMuted: '#A7AEC3',
  cardBackground: 'rgba(17, 20, 39, 0.88)',
  cardBorder: 'rgba(255, 255, 255, 0.14)',
  overlay: 'rgba(3, 5, 15, 0.66)',
};

const RESTAURANT_IMAGE = {
  uri: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=85',
};

export default function WelcomeScreen() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const [checkingSession, setCheckingSession] = useState(true);

  const compact = width < 360;
  const shortScreen = height < 740;

  // ===================================================
  // VALIDACIÓN DE SESIÓN EXISTENTE (ORIGINAL Y ESTABLE)
  // ===================================================

  useEffect(() => {
    let mounted = true;

    const checkActiveSession = async () => {
      try {
        await Promise.all([
          deviceStorage.remove('is_server'),
          deviceStorage.remove('server_ip'),
          deviceStorage.remove('pairing_secret'),
        ]);
        const user = await authSession.getUser();

        if (!mounted) return;

        if (user && user.tenant_id) {
          if (user.role === 'restaurant_admin') {
            router.replace('/(admin)/dashboard');
          } else if (user.waiter_session_token) {
            router.replace('/(waiter)/tables');
          } else {
            await authSession.clear();
          }

          return;
        }
      } catch {
        console.warn('No se encontró una sesión activa.');
      } finally {
        if (mounted) {
          setCheckingSession(false);
        }
      }
    };

    checkActiveSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  // ===================================================
  // PANTALLA DE CARGA
  // ===================================================

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <StatusBar style="light" />

        <View style={styles.loadingLogo}>
          <Ionicons
            name="restaurant-outline"
            size={34}
            color={COLORS.white}
          />
        </View>

        <ActivityIndicator
          size="large"
          color={COLORS.primaryLight}
          style={{ marginTop: 24 }}
        />

        <Text style={styles.loadingText}>
          Preparando Comanda Cloud...
        </Text>
      </SafeAreaView>
    );
  }

  // ===================================================
  // PANTALLA PRINCIPAL
  // ===================================================

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <ImageBackground
        source={RESTAURANT_IMAGE}
        style={styles.background}
        resizeMode="cover"
      >
        <View
          pointerEvents="none"
          style={styles.backgroundOverlay}
        />

        <SafeAreaView
          style={styles.safeArea}
          edges={['top', 'bottom']}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              {
                paddingHorizontal: compact ? 20 : 28,
                paddingTop: shortScreen ? 12 : 24,
                paddingBottom: shortScreen ? 12 : 22,
                minHeight: height,
              },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {/* ENCABEZADO */}
            <View style={styles.header}>
              <View style={styles.brandContainer}>
                <View style={styles.logoContainer}>
                  <Ionicons
                    name="cloud-outline"
                    size={54}
                    color={COLORS.white}
                  />

                  <Ionicons
                    name="restaurant"
                    size={24}
                    color={COLORS.white}
                    style={styles.logoRestaurant}
                  />
                </View>

                <View>
                  <Text style={styles.brandTitle}>
                    Comanda
                  </Text>

                  <Text style={styles.brandTitle}>
                    Cloud
                  </Text>
                </View>
              </View>
            </View>

            {/* BIENVENIDA */}
            <View style={styles.heroSection}>
              <Text style={styles.welcomeTitle}>
                ¡Bienvenido!
              </Text>

              <Text style={styles.welcomeSubtitle}>
                Selecciona cómo deseas ingresar
              </Text>

              <View style={styles.titleDivider} />
            </View>

            {/* ACCESOS RÁPIDOS */}
            <View style={styles.accessContainer}>
              {/* ADMINISTRADOR / CAJA */}
              <TouchableOpacity
                style={styles.accessCard}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Administrador o Caja"
                accessibilityHint="Abre el inicio de sesión con correo y contraseña"
                onPress={() =>
                  router.push('/(auth)/admin-login')
                }
              >
                <View
                  style={[
                    styles.accessIcon,
                    styles.adminIcon,
                  ]}
                >
                  <Ionicons
                    name="storefront"
                    size={35}
                    color={COLORS.white}
                  />
                </View>

                <View style={styles.accessInfo}>
                  <Text style={styles.accessTitle}>
                    Administrador / Caja
                  </Text>

                  <Text style={styles.accessDescription}>
                    Gestiona tu restaurante, ventas y reportes.
                  </Text>
                </View>

                <View style={styles.accessArrow}>
                  <Ionicons
                    name="arrow-forward"
                    size={21}
                    color={COLORS.white}
                  />
                </View>
              </TouchableOpacity>

              {/* MESERO */}
              <TouchableOpacity
                style={styles.accessCard}
                activeOpacity={0.82}
                accessibilityRole="button"
                accessibilityLabel="Mesero"
                accessibilityHint="Abre el acceso de turno con restaurante, nombre y PIN"
                onPress={() =>
                  router.push('/(auth)/pin-login')
                }
              >
                <View
                  style={[
                    styles.accessIcon,
                    styles.waiterIcon,
                  ]}
                >
                  <Ionicons
                    name="restaurant"
                    size={35}
                    color={COLORS.white}
                  />
                </View>

                <View style={styles.accessInfo}>
                  <Text style={styles.accessTitle}>
                    Mesero
                  </Text>

                  <Text style={styles.accessDescription}>
                    Toma pedidos y atiende a tus clientes.
                  </Text>
                </View>

                <View style={styles.accessArrow}>
                  <Ionicons
                    name="arrow-forward"
                    size={21}
                    color={COLORS.white}
                  />
                </View>
              </TouchableOpacity>
            </View>

            {/* PIE Y MARCA */}
            <View style={styles.footer}>
              <View style={styles.footerWave}>
                <View style={styles.waveAccent} />

                <View style={styles.footerContent}>
                  <Ionicons
                    name="restaurant-outline"
                    size={21}
                    color="#C8BEFF"
                  />

                  <Text style={styles.footerBrand}>
                    COMANDA CLOUD
                  </Text>

                  <Text style={styles.footerDescription}>
                    Tecnología para tu restaurante
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

// =====================================================
// ESTILOS
// =====================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  background: {
    flex: 1,
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.overlay,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 14,
  },
  header: {
    marginBottom: 34,
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoContainer: {
    width: 66,
    height: 62,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  logoRestaurant: {
    position: 'absolute',
    top: 20,
  },
  brandTitle: {
    color: COLORS.white,
    fontSize: 21,
    lineHeight: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroSection: {
    marginBottom: 24,
  },
  welcomeTitle: {
    color: COLORS.white,
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  welcomeSubtitle: {
    color: '#F0F0F7',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 4,
  },
  titleDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 20,
  },
  accessContainer: {
    gap: 15,
  },
  accessCard: {
    minHeight: 116,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 23,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 5,
  },
  accessIcon: {
    width: 64,
    height: 64,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminIcon: {
    backgroundColor: COLORS.primary,
  },
  waiterIcon: {
    backgroundColor: '#079669',
  },
  accessInfo: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  accessTitle: {
    color: COLORS.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  accessDescription: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  accessArrow: {
    width: 35,
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    marginTop: 28,
    minHeight: 95,
    justifyContent: 'flex-end',
  },
  footerWave: {
    minHeight: 95,
    marginHorizontal: -28,
    overflow: 'hidden',
    backgroundColor: 'rgba(48, 29, 139, 0.75)',
    borderTopLeftRadius: 75,
    borderTopRightRadius: 25,
  },
  waveAccent: {
    position: 'absolute',
    top: -22,
    left: -30,
    right: -20,
    height: 55,
    backgroundColor: 'rgba(104, 69, 255, 0.36)',
    borderRadius: 80,
    transform: [{ rotate: '-5deg' }],
  },
  footerContent: {
    flex: 1,
    paddingTop: 26,
    paddingBottom: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerBrand: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: 5,
  },
  footerDescription: {
    color: '#D5D0F5',
    fontSize: 10,
    marginTop: 4,
  },
});