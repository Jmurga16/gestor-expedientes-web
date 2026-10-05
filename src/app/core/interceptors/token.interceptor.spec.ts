import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { TokenInterceptor } from './token.interceptor';
import { TokenService } from '../../auth/services/token.service';
import { environment } from '../../../environments/environment';

describe('TokenInterceptor', () => {
  let http: HttpClient;
  let mock: HttpTestingController;
  let token: any;
  beforeEach(() => {
    token = {getToken:()=> 'qa-token', logOut:jasmine.createSpy()};
    TestBed.configureTestingModule({providers:[
      provideHttpClient(withInterceptors([TokenInterceptor])), provideHttpClientTesting(),
      {provide:TokenService,useValue:token}, {provide:Router,useValue:{navigate:jasmine.createSpy()}}
    ]});
    http=TestBed.inject(HttpClient);
    mock=TestBed.inject(HttpTestingController);
  });
  afterEach(()=>mock.verify());

  it('envía el token a la API', () => {
    const url=environment.apiUrl+'/demanda';
    http.get(url).subscribe();
    const request=mock.expectOne(url);
    expect(request.request.headers.get('Authorization')).toBe('Bearer qa-token');
    request.flush({});
  });

  it('no envía el token a blobs, assets ni dominios externos', () => {
    for (const url of ['http://127.0.0.1:10010/devstoreaccount1/demanda-bpmn/qa.bpmn?sig=qa',
      '/assets/demo/base.bpmn', 'https://externo.invalid/?url='+environment.apiUrl]) {
      http.get(url).subscribe({error:()=>{}});
      const request=mock.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBeFalse();
      request.flush({}, {status:401,statusText:'Unauthorized'});
    }
    expect(token.logOut).not.toHaveBeenCalled();
  });

  it('cierra sesión por un 401 de la API', () => {
    const url=environment.apiUrl+'/demanda';
    http.get(url).subscribe({error:()=>{}});
    mock.expectOne(url).flush({}, {status:401,statusText:'Unauthorized'});
    expect(token.logOut).toHaveBeenCalled();
  });
});
