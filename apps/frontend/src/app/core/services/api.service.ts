import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly httpClient = inject(HttpClient);

  get<T>(path: string) {
    return this.httpClient.get<T>(this.resolveUrl(path));
  }

  post<T>(path: string, body: unknown) {
    return this.httpClient.post<T>(this.resolveUrl(path), body);
  }

  patch<T>(path: string, body: unknown) {
    return this.httpClient.patch<T>(this.resolveUrl(path), body);
  }

  delete<T>(path: string) {
    return this.httpClient.delete<T>(this.resolveUrl(path));
  }

  private resolveUrl(path: string): string {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    return `${environment.apiBaseUrl}${path}`;
  }
}
