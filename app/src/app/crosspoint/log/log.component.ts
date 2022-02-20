import { Component, OnInit } from '@angular/core';
import { CrosspointService } from '../crosspoint.service';

@Component({
  selector: 'log',
  templateUrl: './log.component.html',
  styleUrls: ['./log.component.scss'],
})
export class LogComponent implements OnInit {
  list: any[] = [];
  details: any = null;
  constructor(private crosspointService: CrosspointService) {
    this.crosspointService.sync('log').subscribe((log: any) => {
      this.list = log.logList;
      
    });
  }

  getRaw() {
    let raw = {};
    switch (this.details.type) {
      case "httpRequest":
        let copy = JSON.parse(JSON.stringify(this.details.raw));
        try {
          copy.config.data = JSON.parse(copy.config.data);
          raw = copy;
        } catch (e) {
          raw = this.details.raw;
        }
        break;
      default:
        raw = this.details.raw;
    }
    
    return JSON.stringify(raw,null, 2);
  }

  ngOnInit(): void {}
}
