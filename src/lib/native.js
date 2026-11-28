// Đang chạy trong app Android (Capacitor) hay trên trình duyệt
export const isNative = typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();

// Link tải APK mới nhất, điền lúc build trên GitHub
// eslint-disable-next-line no-undef
export const APK_URL = typeof __APK_URL__ !== 'undefined' ? __APK_URL__ : '';
