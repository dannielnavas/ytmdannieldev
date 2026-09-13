import { Component, inject, OnInit } from '@angular/core';
import { LucideSearch } from '@lucide/angular';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Dashboard } from '../../core/services/dashboard/dashboard';
import { GlobalStorage } from '../../core/store/global-storage';
import { Router } from '@angular/router';

@Component({
  imports: [LucideSearch, ReactiveFormsModule],
  selector: 'app-search',
  styleUrl: './search.css',
  templateUrl: './search.html',
})
export class Search implements OnInit {
  private readonly _youtubeService = inject(Dashboard);
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _globalSotre = inject(GlobalStorage);
  private readonly _router = inject(Router);

  public form!: FormGroup<{ query: FormControl<string | null> }>;

  public ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.form = this._formBuilder.group({
      query: ['', []],
    });
  }

  public onSubmit(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const { query } = this.form.value;
    if (!query) {
      return;
    }
    this._youtubeService.searchSongs(query).subscribe({
      next: (res) => {
        this._globalSotre.setStore('search', res);
        this._router.navigate(['/search']);
      },
    });
  }
}
