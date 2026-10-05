import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { TokenService } from '../../auth/services/token.service';
import { environment } from '../../../environments/environment';

export const TokenInterceptor: HttpInterceptorFn = (request, next) => {
    const tokenService = inject(TokenService);
    const router = inject(Router);

    const token = tokenService.getToken();
    const api = new URL(environment.apiUrl, window.location.origin);
    const target = new URL(request.url, window.location.origin);
    const apiPath = api.pathname.replace(/\/$/, '');
    const isApiRequest = target.origin === api.origin
        && (target.pathname === apiPath || target.pathname.startsWith(apiPath + '/'));
    const isAuthRequest = isApiRequest && target.pathname.startsWith(apiPath + '/auth/');

    if (token && isApiRequest) {
        request = request.clone({
            headers: request.headers.set('Authorization', `Bearer ${token}`)
        });
    }

    return next(request).pipe(
        catchError((error: HttpErrorResponse) => {
            if (error.status === 401 && token && isApiRequest && !isAuthRequest) {
                tokenService.logOut();
                router.navigate(['auth/login']);
            }
            return throwError(() => error);
        })
    );
};
