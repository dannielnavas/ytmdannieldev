import { Pipe, PipeTransform } from '@angular/core';
import { DashboardItem } from '../../core/models/dashboard';
import { getHighResThumbnail } from '../../core/services/image-helper.service';

@Pipe({
  name: 'thumbnailUrl',
})
export class ThumbnailUrlPipe implements PipeTransform {
  transform(value: DashboardItem, size = 400): string {
    if (!value.thumbnails || value.thumbnails.length === 0) {
      return '';
    }
    const raw = value.thumbnails[value.thumbnails.length - 1]?.url || value.thumbnails[0]?.url || '';
    return getHighResThumbnail(raw, size);
  }
}
