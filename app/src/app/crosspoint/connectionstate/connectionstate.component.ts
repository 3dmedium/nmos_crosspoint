import { Component, OnInit } from '@angular/core';
import { CrosspointService } from '../crosspoint.service';

@Component({
  selector: 'connectionstate',
  templateUrl: './connectionstate.component.html',
})
export class ConnectionstateComponent implements OnInit {
  registries: any[] = [];
  constructor(public crosspointService: CrosspointService) {
    this.crosspointService.sync('connectionState').subscribe((state: any) => {
      
      this.registries = state.registries;
    });
  }
  ngOnInit(): void {}
}
