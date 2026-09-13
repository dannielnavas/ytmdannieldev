import { Pipe, PipeTransform } from '@angular/core';
import { DashboardItem } from '../../core/models/dashboard';

@Pipe({
  name: 'thumbnailUrl',
})
export class ThumbnailUrlPipe implements PipeTransform {
  transform(value: DashboardItem): string {
    if (!value.thumbnails || value.thumbnails.length === 0) {
      return '';
    }
    return value.thumbnails[value.thumbnails.length - 1]?.url || value.thumbnails[0]?.url;
  }
}
