import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { FileService } from './file.service';

describe('FileService: firma de archivos', () => {
  it('pide firma al backend para el almacenamiento de otro entorno', () => {
    TestBed.configureTestingModule({imports:[HttpClientTestingModule]});
    const service=TestBed.inject(FileService), http=TestBed.inject(HttpTestingController);
    const url='http://127.0.0.1:10010/devstoreaccount1/demanda-bpmn/qa.bpmn';
    let resolved='';
    service.resolveUrl(url).subscribe(value=>resolved=value);
    const req=http.expectOne(request=>request.url.endsWith('/file/view') && request.params.get('url')===url);
    req.flush({url:url+'?sig=qa'});
    expect(resolved).toBe(url+'?sig=qa');
    service.resolveUrl('/assets/demo/base.bpmn').subscribe(value=>expect(value).toBe('/assets/demo/base.bpmn'));
    http.verify();
  });
});
