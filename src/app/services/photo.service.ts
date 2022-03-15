import { Injectable } from '@angular/core';
import {
  Camera,
  CameraResultType,
  CameraSource,
  Photo,
  GalleryImageOptions,
  GalleryPhoto,
  ImageOptions,
  PermissionStatus,
  CameraDirection,
} from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Storage } from '@capacitor/storage';
import { Platform } from '@ionic/angular';



@Injectable({
  providedIn: 'root',
})
export class PhotoService {
  public photos: UserPhoto[] = [];
  private PHOTO_STORAGE: string = 'photos';

  constructor(private platform: Platform) {}

  public async loadSaved() {
    // Retrieve cached photo array data
    const photoList = await Storage.get({ key: this.PHOTO_STORAGE });
    this.photos = JSON.parse(photoList.value) || [];

    // If running on the web...
    if (!this.platform.is('hybrid')) {
      // Display the photo by reading into base64 format
      for (let photo of this.photos) {
        // Read each saved photo's data from the Filesystem
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: Directory.Data,
        });

        // Web platform only: Load the photo as base64 data
        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }
    }

    try {
      const permissions = await Camera.checkPermissions();
      console.log('Camera.permissions = ', permissions)
    } catch {
      console.log('Camera.permissions error ')
    }
  }

  /* Use the device camera to take a photo:
  // https://capacitor.ionicframework.com/docs/apis/camera

  // Store the photo data into permanent file storage:
  // https://capacitor.ionicframework.com/docs/apis/filesystem

  // Store a reference to all photo filepaths using Storage API:
  // https://capacitor.ionicframework.com/docs/apis/storage
  */
  public async takePhoto() {
    try {
      const imageOptions: ImageOptions = {
        quality: 90,
        preserveAspectRatio: true,
        allowEditing: false,
        direction: CameraDirection.Rear,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
      };
      if (Capacitor.getPlatform() === 'ios') {
        imageOptions.width = 800;
      }
      const newImage = await Camera.getPhoto(imageOptions);
      delete newImage.saved;
      await this.saveImages([{
        format: newImage.format,
        webPath: newImage.webPath,
      }]);
    } catch {
      console.log('Add photo failed.');
    }

    // Take a photo
    // const capturedPhoto = await Camera.getPhoto({
    //   resultType: CameraResultType.Uri, // file-based data; provides best performance
    //   source: CameraSource.Camera, // automatically take a new photo with the camera
    //   quality: 100, // highest quality (0 to 100)
    // });
    // await this.saveImages([{ format: 'jpeg', webPath: capturedPhoto.webPath }]);
  }

  async selectPhotos() {
    try {
      const galleryImageOptions: GalleryImageOptions = {
        quality: 90,
      };
      if (Capacitor.getPlatform() === 'ios') {
        galleryImageOptions.width = 800;
      }
      const newGalleryImages = await Camera.pickImages(galleryImageOptions);
      console.log('newGalleryImages = ', newGalleryImages);
      const selectedPhotos = newGalleryImages.photos
        .map((photo) => {
          return { format: photo.format, webPath: photo.webPath, saved: false };
        });
      await this.saveImages(selectedPhotos);
    } catch (error) {
      console.log('Add gallery images failed: error = ', error);
    }
  }

  async saveImages(photos: GalleryPhoto[]) {
    for (const photo of photos) {
      const savedImageFile = await this.savePicture({ ...photo, saved: false, });
      console.log('savedImageFile = ', savedImageFile);
      this.photos.unshift(savedImageFile);
      Storage.set({
        key: this.PHOTO_STORAGE,
        value: JSON.stringify(this.photos),
      });
    }
  }

  // Save picture to file on device
  private async savePicture(cameraPhoto: Photo) {
  // private async savePicture(cameraPhoto: Photo) {
    // Convert photo to base64 format, required by Filesystem API to save
    const base64Data = await this.readAsBase64(cameraPhoto);

    // Write the file to the data directory
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    if (this.platform.is('hybrid')) {
      // Display the new image by rewriting the 'file://' path to HTTP
      // Details: https://ionicframework.com/docs/building/webview#file-protocol
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      };
    } else {
      // Use webPath to display the new image instead of base64 since it's
      // already loaded into memory
      return {
        filepath: fileName,
        webviewPath: cameraPhoto.webPath,
      };
    }
  }

  // Read camera photo into base64 format based on the platform the app is running on
  private async readAsBase64(cameraPhoto: Photo) {
    // "hybrid" will detect Cordova or Capacitor
    if (this.platform.is('hybrid')) {
      // Read the file into base64 format
      const file = await Filesystem.readFile({
        path: cameraPhoto.path,
      });

      return file.data;
    } else {
      // Fetch the photo, read as a blob, then convert to base64 format
      const response = await fetch(cameraPhoto.webPath!);
      const blob = await response.blob();

      return (await this.convertBlobToBase64(blob)) as string;
    }
  }

  // Delete picture by removing it from reference data and the filesystem
  public async deletePicture(photo: UserPhoto, position: number) {
    // Remove this photo from the Photos reference data array
    this.photos.splice(position, 1);

    // Update photos array cache by overwriting the existing photo array
    Storage.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos),
    });

    // delete photo file from filesystem
    const filename = photo.filepath.substr(photo.filepath.lastIndexOf('/') + 1);
    await Filesystem.deleteFile({
      path: filename,
      directory: Directory.Data,
    });
  }

  convertBlobToBase64 = (blob: Blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        resolve(reader.result);
      };
      reader.readAsDataURL(blob);
    });
}

export interface UserPhoto {
  filepath: string;
  webviewPath: string;
}
