import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrosspointComponent } from './crosspoint.component';

describe('CrosspointComponent', () => {
  let component: CrosspointComponent;
  let fixture: ComponentFixture<CrosspointComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CrosspointComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CrosspointComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
