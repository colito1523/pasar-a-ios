import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Alert,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import es from '../locales/es.json';
import en from '../locales/en.json';
import pt from '../locales/pt.json';

const LANGUAGE_KEY = '@app_language';

i18n
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v3',
    resources: {
      es: { translation: es },
      en: { translation: en },
      pt: { translation: pt },
    },
    lng: 'es',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

const { width, height } = Dimensions.get('window');

export default function ElegantForgotPassword({ navigation }) {
  const [email, setEmail] = useState('');
  const [isNightMode, setIsNightMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLanguageOptionsVisible, setIsLanguageOptionsVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const checkTime = () => {
      const currentHour = new Date().getHours();
      setIsNightMode(currentHour >= 19 || currentHour < 6);
    };

    checkTime();
    const interval = setInterval(checkTime, 60000);

    loadSavedLanguage();

    return () => clearInterval(interval);
  }, []);

  const loadSavedLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (savedLanguage) {
        i18n.changeLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading saved language:', error);
    }
  };

  const changeLanguage = async (lang) => {
    i18n.changeLanguage(lang);
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
    setIsLanguageOptionsVisible(false);
  };

  const onResetPassword = () => {
    if (email.trim() === '') {
      Alert.alert(t('errorTitle'), t('enterEmail'));
      return;
    }

    const emailToLower = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailToLower)) {
      Alert.alert(t('errorTitle'), t('enterValidEmail'));
      return;
    }

    setIsLoading(true);

    sendPasswordResetEmail(auth, emailToLower)
      .then(() => {
        setIsLoading(false);
        Alert.alert(
          t('resetPasswordEmailSent'),
          t('checkEmailForInstructions')
        );
        navigation.navigate('Login');
      })
      .catch((error) => {
        setIsLoading(false);
        Alert.alert(t('resetPasswordError'), t('genericError'));
      });
  };

  const theme = isNightMode ? darkTheme : lightTheme;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: '#fff' }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scrollView}>
          <LinearGradient
            colors={['#fff', '#fff']}
            style={styles.container}
          >
            <View style={styles.languageContainer}>
              <TouchableOpacity
                style={styles.languageButton}
                onPress={() => setIsLanguageOptionsVisible(!isLanguageOptionsVisible)}
              >
                <Ionicons name="ellipsis-vertical" size={24} color="#000" />
              </TouchableOpacity>
              {isLanguageOptionsVisible && (
                <View style={styles.languageOptions}>
                  <TouchableOpacity
                    style={styles.languageOption}
                    onPress={() => changeLanguage('es')}
                  >
                    <Text style={styles.languageOptionText}>Español</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.languageOption}
                    onPress={() => changeLanguage('en')}
                  >
                    <Text style={styles.languageOptionText}>English</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.languageOption}
                    onPress={() => changeLanguage('pt')}
                  >
                    <Text style={styles.languageOptionText}>Português</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            
            <Text style={[styles.title, { color: theme.text }]}>
              {t('forgotPassword')}
            </Text>
            
            <Text style={[styles.subtitle, { color: theme.text }]}>
              {t('enterEmailToReset')}
            </Text>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={t('email')}
                placeholderTextColor="#999"
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <TouchableOpacity
              style={[styles.resetButton, { backgroundColor: theme.buttonBackground }]}
              onPress={onResetPassword}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#333" />
              ) : (
                <Text style={styles.resetButtonText}>{t('resetPassword')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={[styles.backButtonText, { color: theme.link }]}>
                {t('backToLogin')}
              </Text>
            </TouchableOpacity>
          </LinearGradient>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 20,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resetButton: {
    width: '50%',
    height: 50,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  resetButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  languageContainer: {
    position: 'absolute',
    top: 40,
    right: 20,
    alignItems: 'flex-end',
  },
  languageButton: {
    padding: 10,
  },
  languageOptions: {
    backgroundColor: 'white',
    borderRadius: 5,
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  languageOption: {
    padding: 10,
  },
  languageOptionText: {
    fontSize: 16,
    color: '#333',
  },
});

const lightTheme = {
  background: '#fff',
  text: '#333',
  inputBackground: '#f5f5f5',
  placeholder: '#999',
  buttonBackground: '#f5f5f5',
  link: 'black',
};

const darkTheme = {
  background: '#000',
  text: '#fff',
  inputBackground: '#1a1a1a',
  placeholder: '#666',
  buttonBackground: '#f5f5f5',
  link: 'black',
};