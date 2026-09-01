import mongoose, { Document, Schema } from 'mongoose';

export interface ISettings extends Document {
  // Business
  platformName: string;
  contactNo: string;
  inquiryEmail: string;
  siteDescription: string;
  copyrightText: string;
  facebookUrl: string;
  twitterUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  // Branding
  logoUrl: string;
  darkLogoUrl: string;
  lightLogoUrl: string;
  faviconUrl: string;
  logoStyle: 'icon' | 'fill';
  loginTitle: string;
  loginSubtitle: string;
  loginButtonText: string;
  // Mail
  mailEmail: string;
  mailDriver: string;
  mailHost: string;
  mailPort: string;
  mailEncryption: string;
  mailUsername: string;
  mailPassword: string;
  mailFrom: string;
  mailFromName: string;
  // Storage
  storageDriver: 'local' | 's3' | 'bunny';
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsRegion: string;
  awsBucket: string;
  awsPathStyleEndpoint: boolean;
  bunnyStorageZone: string;
  bunnyAccessKey: string;
  bunnyCdnUrl: string;
  // Customization
  primaryColor: string;
  colorTheme: string;
  navbarStyle: 'glass' | 'sticky' | 'transparent' | 'default';
  navbarHide: boolean;
  cardStyle: 'default' | 'glass' | 'transparent';
  menuStyle: 'mini' | 'hover' | 'boxed' | 'soft';
  activeMenuStyle: string;
  // Custom Code
  headerCode: string;
  footerCode: string;
  // Modules
  moduleUsers: boolean;
  moduleLanguages: boolean;
  moduleAds: boolean;
  modulePromotions: boolean;
  moduleBanners: boolean;
  modulePages: boolean;
  moduleMovies: boolean;
  moduleTvShows: boolean;
  moduleLiveTV: boolean;
  moduleVideos: boolean;
  moduleCastCrew: boolean;
  moduleAdsManager: boolean;
  moduleSubscriptions: boolean;
  modulePlans: boolean;
  // Misc
  maintenanceMode: boolean;
  userRegistration: boolean;
  socialLogin: boolean;
  twoFactorAuth: boolean;
  emailVerification: boolean;
  // VIP Settings
  vipTitle: string;
  vipHighlight: string;
  vipSubtitle: string;
  // Social OAuth credentials
  googleClientId: string;
  appleClientId: string;
  appleTeamId: string;
  appleKeyId: string;
  applePrivateKey: string;
  // Notifications
  fcmServerKey: string;
  fcmSenderId: string;
  firebaseApiKey: string;
  firebaseProjectId: string;
  firebaseAppId: string;
  // Language
  defaultLanguage: string;
  rtlSupport: boolean;
  // Notification Configuration
  notifNewUser: boolean;
  notifNewSubscription: boolean;
  notifNewContent: boolean;
  notifPaymentSuccess: boolean;
  notifPaymentFailed: boolean;
  notifContentExpiry: boolean;
  // Currency
  currencyCode: string;
  currencySymbol: string;
  currencyPosition: 'before' | 'after';
  decimalPlaces: number;
  // SEO
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  googleAnalyticsId: string;
  seoImage: string;
  googleVerification: string;
  canonicalUrl: string;
  // Ad Networks
  adNetworkEnabled: boolean;
  adMobPublisherId: string;
  adMobAppIdAndroid: string;
  adMobAppIdIos: string;
  adMobBannerAndroid: string;
  adMobBannerIos: string;
  adMobInterstitialAndroid: string;
  adMobInterstitialIos: string;
  vastPrerollUrl: string;
  vastMidrollUrl: string;
  // Payments
  razorpayEnabled: boolean;
  razorpayKeyId: string;
  razorpayKeySecret: string;
}

const SettingsSchema = new Schema<ISettings>(
  {
    // Business
    platformName: { type: String, default: 'Triple Minds' },
    contactNo: { type: String, default: '' },
    inquiryEmail: { type: String, default: '' },
    siteDescription: { type: String, default: '' },
    copyrightText: { type: String, default: '© 2026 Triple Minds. All Rights Reserved.' },
    facebookUrl: { type: String, default: '' },
    twitterUrl: { type: String, default: '' },
    instagramUrl: { type: String, default: '' },
    youtubeUrl: { type: String, default: '' },
    // Branding
    logoUrl: { type: String, default: 'https://i.imgur.com/45cG5Kc.png' },
    darkLogoUrl: { type: String, default: 'https://i.imgur.com/45cG5Kc.png' },
    lightLogoUrl: { type: String, default: 'https://i.imgur.com/45cG5Kc.png' },
    faviconUrl: { type: String, default: '' },
    logoStyle: { type: String, enum: ['icon', 'fill'], default: 'fill' },
    loginTitle: { type: String, default: 'Welcome Back' },
    loginSubtitle: { type: String, default: 'Admin Console' },
    loginButtonText: { type: String, default: 'Sign In' },
    // Mail
    mailEmail: { type: String, default: '' },
    mailDriver: { type: String, default: 'smtp' },
    mailHost: { type: String, default: 'smtp.gmail.com' },
    mailPort: { type: String, default: '587' },
    mailEncryption: { type: String, default: 'tls' },
    mailUsername: { type: String, default: '' },
    mailPassword: { type: String, default: '' },
    mailFrom: { type: String, default: 'info@tripleminds.com' },
    mailFromName: { type: String, default: 'Triple Minds' },
    // Storage
    storageDriver: { type: String, enum: ['local', 's3', 'bunny'], default: 'local' },
    awsAccessKeyId: { type: String, default: '' },
    awsSecretAccessKey: { type: String, default: '' },
    awsRegion: { type: String, default: '' },
    awsBucket: { type: String, default: '' },
    awsPathStyleEndpoint: { type: Boolean, default: false },
    bunnyStorageZone: { type: String, default: '' },
    bunnyAccessKey: { type: String, default: '' },
    bunnyCdnUrl: { type: String, default: '' },
    // Customization
    primaryColor: { type: String, default: '#e50914' },
    colorTheme: { type: String, default: 'blue-green' },
    navbarStyle: { type: String, enum: ['glass', 'sticky', 'transparent', 'default'], default: 'default' },
    navbarHide: { type: Boolean, default: false },
    cardStyle: { type: String, enum: ['default', 'glass', 'transparent'], default: 'default' },
    menuStyle: { type: String, enum: ['mini', 'hover', 'boxed', 'soft'], default: 'hover' },
    activeMenuStyle: { type: String, default: 'left-bordered' },
    // Custom Code
    headerCode: { type: String, default: '' },
    footerCode: { type: String, default: '' },
    // Modules
    moduleUsers: { type: Boolean, default: true },
    moduleLanguages: { type: Boolean, default: true },
    moduleAds: { type: Boolean, default: true },
    modulePromotions: { type: Boolean, default: true },
    moduleBanners: { type: Boolean, default: true },
    modulePages: { type: Boolean, default: true },
    moduleMovies: { type: Boolean, default: true },
    moduleTvShows: { type: Boolean, default: true },
    moduleLiveTV: { type: Boolean, default: true },
    moduleVideos: { type: Boolean, default: true },
    moduleCastCrew: { type: Boolean, default: true },
    moduleAdsManager: { type: Boolean, default: true },
    moduleSubscriptions: { type: Boolean, default: true },
    modulePlans: { type: Boolean, default: true },
    // Misc
    maintenanceMode: { type: Boolean, default: false },
    userRegistration: { type: Boolean, default: true },
    socialLogin: { type: Boolean, default: true },
    twoFactorAuth: { type: Boolean, default: false },
    emailVerification: { type: Boolean, default: true },
    // VIP Settings
    vipTitle: { type: String, default: 'Unlock the' },
    vipHighlight: { type: String, default: 'Ultimate Experience' },
    vipSubtitle: { type: String, default: 'Get unlimited ad-free streaming, offline downloads, and exclusive access to our premium catalog.' },
    // Social OAuth credentials
    googleClientId: { type: String, default: '' },
    appleClientId: { type: String, default: '' },
    appleTeamId: { type: String, default: '' },
    appleKeyId: { type: String, default: '' },
    applePrivateKey: { type: String, default: '' },
    // Notifications
    fcmServerKey: { type: String, default: '' },
    fcmSenderId: { type: String, default: '' },
    firebaseApiKey: { type: String, default: '' },
    firebaseProjectId: { type: String, default: '' },
    firebaseAppId: { type: String, default: '' },
    // Language
    defaultLanguage: { type: String, default: 'en' },
    rtlSupport: { type: Boolean, default: false },
    // Notification Configuration
    notifNewUser: { type: Boolean, default: true },
    notifNewSubscription: { type: Boolean, default: true },
    notifNewContent: { type: Boolean, default: false },
    notifPaymentSuccess: { type: Boolean, default: true },
    notifPaymentFailed: { type: Boolean, default: true },
    notifContentExpiry: { type: Boolean, default: false },
    // Currency
    currencyCode: { type: String, default: 'USD' },
    currencySymbol: { type: String, default: '$' },
    currencyPosition: { type: String, enum: ['before', 'after'], default: 'before' },
    decimalPlaces: { type: Number, default: 2 },
    // SEO
    metaTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    metaKeywords: { type: String, default: '' },
    googleAnalyticsId: { type: String, default: '' },
    seoImage: { type: String, default: '' },
    googleVerification: { type: String, default: '' },
    canonicalUrl: { type: String, default: '' },
    // Ad Networks
    adNetworkEnabled: { type: Boolean, default: false },
    adMobPublisherId: { type: String, default: '' },
    adMobAppIdAndroid: { type: String, default: '' },
    adMobAppIdIos: { type: String, default: '' },
    adMobBannerAndroid: { type: String, default: '' },
    adMobBannerIos: { type: String, default: '' },
    adMobInterstitialAndroid: { type: String, default: '' },
    adMobInterstitialIos: { type: String, default: '' },
    vastPrerollUrl: { type: String, default: '' },
    vastMidrollUrl: { type: String, default: '' },
    // Payments
    razorpayEnabled: { type: Boolean, default: false },
    razorpayKeyId: { type: String, default: '' },
    razorpayKeySecret: { type: String, default: '' },
  },
  { timestamps: true }
);

export const SettingsModel = mongoose.model<ISettings>('Settings', SettingsSchema);
