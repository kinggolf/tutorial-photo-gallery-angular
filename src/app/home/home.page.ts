import { Component } from '@angular/core';
import { ActionSheetController } from '@ionic/angular';
import {
  Camera,
  CameraDirection,
  CameraResultType,
  CameraSource,
  GalleryImageOptions,
  GalleryPhoto,
  ImageOptions,
  Photo
} from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Storage } from '@capacitor/storage';
import { Platform } from '@ionic/angular';

export interface UserPhoto {
  filepath: string;
  webviewPath: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss']
})
export class HomePage {
  public photos: UserPhoto[] = [];
  private PHOTO_STORAGE: string = 'photos';

  constructor(
    public actionSheetController: ActionSheetController,
    private platform: Platform,
  ) {}

  async ngOnInit() {
    await this.loadSaved();
  }

  public async loadSaved() {
    const photoList = await Storage.get({ key: this.PHOTO_STORAGE });
    this.photos = JSON.parse(photoList.value) || [];

    if (!this.platform.is('hybrid')) {
      for (let photo of this.photos) {
        const readFile = await Filesystem.readFile({
          path: photo.filepath,
          directory: Directory.Data,
        });

        photo.webviewPath = `data:image/jpeg;base64,${readFile.data}`;
      }
    }

    try {
      const permissions = await Camera.checkPermissions();
      console.log('Camera.permissions = ', permissions)
    } catch (error) {
      console.log('Camera.permissions error = ', error)
    }
  }

  public async takePhoto() {
    try {
      const imageOptions: ImageOptions = {
        quality: 90,
        preserveAspectRatio: true,
        allowEditing: false,
        direction: CameraDirection.Rear,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        presentationStyle: 'fullscreen',
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
  }
  // presentationStyle?: 'fullscreen' | 'popover';

  public async takePhoto1() {
    try {
      const imageOptions: ImageOptions = {
        quality: 90,
        preserveAspectRatio: true,
        allowEditing: false,
        direction: CameraDirection.Rear,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        presentationStyle: 'popover',
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

  private async savePicture(cameraPhoto: Photo) {
    const base64Data = await this.readAsBase64(cameraPhoto);
    const fileName = new Date().getTime() + '.jpeg';
    const savedFile = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Data,
    });

    if (this.platform.is('hybrid')) {
      return {
        filepath: savedFile.uri,
        webviewPath: Capacitor.convertFileSrc(savedFile.uri),
      };
    } else {
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

  public async deletePicture(photo: UserPhoto, position: number) {
    this.photos.splice(position, 1);
    Storage.set({
      key: this.PHOTO_STORAGE,
      value: JSON.stringify(this.photos),
    });
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

  public async showActionSheet(photo: UserPhoto, position: number) {
    const actionSheet = await this.actionSheetController.create({
      header: 'Photos',
      buttons: [{
        text: 'Delete',
        role: 'destructive',
        icon: 'trash',
        handler: () => {
          this.deletePicture(photo, position);
        }
      }, {
        text: 'Cancel',
        icon: 'close',
        role: 'cancel',
        handler: () => {
          // Nothing to do, action sheet is automatically closed
         }
      }]
    });
    await actionSheet.present();
  }

  reload() {
    window.location.reload();
  }
}
