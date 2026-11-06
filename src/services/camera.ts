import { Camera } from 'expo-camera';
import type { Permission, PermissionStatus } from './Permission';

export const cameraPermission: Permission = {
  getPermission: async () => (await Camera.getCameraPermissionsAsync()).status as PermissionStatus,
  requestPermission: async () => (await Camera.requestCameraPermissionsAsync()).granted,
};
