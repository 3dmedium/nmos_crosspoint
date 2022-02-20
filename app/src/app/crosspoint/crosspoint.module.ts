import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { CrosspointRoutingModule } from './crosspoint-routing.module';
import { CrosspointComponent, InformationDialog, SettingsDialog } from './crosspoint.component';
import { ConnectionstateComponent } from './connectionstate/connectionstate.component';
import { HttpClientModule } from '@angular/common/http';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRippleModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import {
  MatDialogModule
} from '@angular/material/dialog';


import { AceEditorModule } from 'ng2-ace-editor';
import { LogComponent } from './log/log.component';

@NgModule({
  declarations: [
    CrosspointComponent,
    InformationDialog,
    SettingsDialog,
    LogComponent,
    ConnectionstateComponent,
  ],
  imports: [
    CommonModule,
    CrosspointRoutingModule,
    HttpClientModule,
    FormsModule,

    MatToolbarModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatRippleModule,
    MatTooltipModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    AceEditorModule,
  ],
})
export class CrosspointModule {}
