import { TestBed } from '@angular/core/testing';

import { CrosspointService } from './crosspoint.service';

describe('CrosspointService', () => {
  let service: CrosspointService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CrosspointService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
