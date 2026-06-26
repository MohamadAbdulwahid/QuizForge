import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from './api.service';
import { ConfigService } from './config.service';

describe('ApiService', () => {
  let apiService: ApiService;
  let httpMock: HttpTestingController;

  const mockConfigService = {
    getBackendUrl: vi.fn(() => 'http://localhost:3333'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ConfigService, useValue: mockConfigService },
      ],
    });
    apiService = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should be created', () => {
    expect(apiService).toBeTruthy();
  });

  it('should resolve relative URLs with ConfigService backendUrl', () => {
    apiService.get('/api/test').subscribe();

    const req = httpMock.expectOne('http://localhost:3333/api/test');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should not modify absolute URLs', () => {
    apiService.get('https://example.com/api/test').subscribe();

    const req = httpMock.expectOne('https://example.com/api/test');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should send POST requests correctly', () => {
    const body = { name: 'test' };
    apiService.post('/api/test', body).subscribe();

    const req = httpMock.expectOne('http://localhost:3333/api/test');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('should send PATCH requests correctly', () => {
    const body = { name: 'updated' };
    apiService.patch('/api/test/1', body).subscribe();

    const req = httpMock.expectOne('http://localhost:3333/api/test/1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(body);
    req.flush({});
  });

  it('should send DELETE requests correctly', () => {
    apiService.delete('/api/test/1').subscribe();

    const req = httpMock.expectOne('http://localhost:3333/api/test/1');
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
