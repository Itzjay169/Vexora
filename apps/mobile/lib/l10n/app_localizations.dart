import 'package:flutter/material.dart';

/// Multi-Language Localization Scaffold
/// Supports:
///   - English ('en')
///   - Hindi ('hi' - हिंदी)
///   - Odia ('or' - ଓଡ଼ିଆ)
class AppLocalizations {
  final Locale locale;

  AppLocalizations(this.locale);

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const List<Locale> supportedLocales = [
    Locale('en'),
    Locale('hi'),
    Locale('or'),
  ];

  static final Map<String, Map<String, String>> _localizedValues = {
    'en': {
      'appTitle': 'Vexora Esports',
      'tagline': 'The Trust-First Competitive Gaming Ecosystem',
      'onboardingTitle1': 'Verified Tournaments',
      'onboardingDesc1': 'Compete in Battlegrounds Mobile India, Free Fire, and CODM with guaranteed prize pools.',
      'onboardingTitle2': 'Deterministic Scoring',
      'onboardingDesc2': 'Every result backed by SHA-256 evidence hashing and tamper-evident audit trails.',
      'onboardingTitle3': 'Fair & Free to Play',
      'onboardingDesc3': '100% Free tournaments at launch with zero risk. Compete for glory and verified rank.',
      'signIn': 'Sign In',
      'phoneSignIn': 'Phone OTP',
      'emailSignIn': 'Email & Password',
      'googleSignIn': 'Continue with Google',
      'phoneNumber': 'Phone Number',
      'enterPhone': 'Enter 10-digit mobile number',
      'getOtp': 'Get Verification Code',
      'verifyOtp': 'Verify & Sign In',
      'profile': 'Gamer Profile',
      'linkedGameIds': 'Linked In-Game IDs',
      'appVersion': 'App Version',
      'signOut': 'Sign Out',
      'selectLanguage': 'Select Language',
    },
    'hi': {
      'appTitle': 'वेक्सोरा ईस्पोर्ट्स',
      'tagline': 'भरोसेमंद प्रतिस्पर्धी गेमिंग प्लेटफॉर्म',
      'onboardingTitle1': 'सत्यापित टूर्नामेंट',
      'onboardingDesc1': 'BGMI, Free Fire और CODM में सुरक्षित पुरस्कारों के साथ खेलें।',
      'onboardingTitle2': 'पारदर्शी स्कोरिंग',
      'onboardingDesc2': 'प्रत्येक परिणाम SHA-256 साक्ष्य हैशिंग द्वारा सत्यापित है।',
      'onboardingTitle3': 'मुफ्त और निष्पक्ष',
      'onboardingDesc3': '100% मुफ्त टूर्नामेंट। बिना किसी जोखिम के अपनी प्रतिभा दिखाएं।',
      'signIn': 'साइन इन करें',
      'phoneSignIn': 'फोन OTP',
      'emailSignIn': 'ईमेल और पासवर्ड',
      'googleSignIn': 'Google से जारी रखें',
      'phoneNumber': 'मोबाइल नंबर',
      'enterPhone': '10 अंकों का मोबाइल नंबर दर्ज करें',
      'getOtp': 'ओटीपी प्राप्त करें',
      'verifyOtp': 'सत्यापित करें और साइन इन करें',
      'profile': 'गेमर प्रोफ़ाइल',
      'linkedGameIds': 'जुड़े हुए गेम आईडी',
      'appVersion': 'ऐप संस्करण',
      'signOut': 'साइन आउट',
      'selectLanguage': 'भाषा चुनें',
    },
    'or': {
      'appTitle': 'ଭେକ୍ସୋରା ଇ-ସ୍ପୋର୍ଟସ୍',
      'tagline': 'ବିଶ୍ୱାସନୀୟ ପ୍ରତିଯୋଗିତାମୂଳକ ଗେମିଂ ପ୍ଲାଟଫର୍ମ',
      'onboardingTitle1': 'ଯାଞ୍ଚ ହୋଇଥିବା ଟୁର୍ଣ୍ଣାମେଣ୍ଟ',
      'onboardingDesc1': 'BGMI, Free Fire ଏବଂ CODM ରେ ସୁରକ୍ଷିତ ପୁରସ୍କାର ସହିତ ପ୍ରତିଦ୍ୱନ୍ଦ୍ୱିତା କରନ୍ତୁ।',
      'onboardingTitle2': 'ସ୍ୱଚ୍ଛ ସ୍କୋରିଂ',
      'onboardingDesc2': 'ପ୍ରତ୍ୟେକ ଫଳାଫଳ SHA-256 ପ୍ରମାଣ ହ୍ୟାସିଂ ଦ୍ୱାରା ସୁରକ୍ଷିତ।',
      'onboardingTitle3': 'ସମ୍ପୂର୍ଣ୍ଣ ମାଗଣା',
      'onboardingDesc3': '100% ମାଗଣା ଟୁର୍ଣ୍ଣାମେଣ୍ଟ। ବିନା କୌଣସି ଦେୟରେ ନିଜ ଦକ୍ଷତା ପ୍ରମାଣ କରନ୍ତୁ।',
      'signIn': 'ସାଇନ୍ ଇନ୍ କରନ୍ତୁ',
      'phoneSignIn': 'ଫୋନ୍ OTP',
      'emailSignIn': 'ଇମେଲ୍ ଏବଂ ପାସୱାର୍ଡ',
      'googleSignIn': 'Google ସହିତ ଜାରି ରଖନ୍ତୁ',
      'phoneNumber': 'ଫୋନ୍ ନମ୍ବର',
      'enterPhone': '10 ଅଙ୍କ ବିଶିଷ୍ଟ ମୋବାଇଲ୍ ନମ୍ବର ଦିଅନ୍ତୁ',
      'getOtp': 'OTP ପ୍ରାପ୍ତ କରନ୍ତୁ',
      'verifyOtp': 'ଯାଞ୍ଚ କରି ସାଇନ୍ ଇନ୍ କରନ୍ତୁ',
      'profile': 'ଗେମର୍ ପ୍ରୋଫାଇଲ୍',
      'linkedGameIds': 'ସଂଯୁକ୍ତ ଇନ୍-ଗେମ୍ ID',
      'appVersion': 'ଆପ୍ ସଂସ୍କରଣ',
      'signOut': 'ସାଇନ୍ ଆଉଟ୍',
      'selectLanguage': 'ଭାଷା ବାଛନ୍ତୁ',
    },
  };

  String get(String key) {
    final langCode = locale.languageCode;
    return _localizedValues[langCode]?[key] ??
        _localizedValues['en']?[key] ??
        key;
  }

  String get appTitle => get('appTitle');
  String get tagline => get('tagline');
  String get onboardingTitle1 => get('onboardingTitle1');
  String get onboardingDesc1 => get('onboardingDesc1');
  String get onboardingTitle2 => get('onboardingTitle2');
  String get onboardingDesc2 => get('onboardingDesc2');
  String get onboardingTitle3 => get('onboardingTitle3');
  String get onboardingDesc3 => get('onboardingDesc3');
  String get signIn => get('signIn');
  String get phoneSignIn => get('phoneSignIn');
  String get emailSignIn => get('emailSignIn');
  String get googleSignIn => get('googleSignIn');
  String get phoneNumber => get('phoneNumber');
  String get enterPhone => get('enterPhone');
  String get getOtp => get('getOtp');
  String get verifyOtp => get('verifyOtp');
  String get profile => get('profile');
  String get linkedGameIds => get('linkedGameIds');
  String get appVersion => get('appVersion');
  String get signOut => get('signOut');
  String get selectLanguage => get('selectLanguage');
}

class AppLocalizationsDelegate extends LocalizationsDelegate<AppLocalizations> {
  const AppLocalizationsDelegate();

  @override
  bool isSupported(Locale locale) => ['en', 'hi', 'or'].contains(locale.languageCode);

  @override
  Future<AppLocalizations> load(Locale locale) async {
    return AppLocalizations(locale);
  }

  @override
  bool shouldReload(AppLocalizationsDelegate old) => false;
}
