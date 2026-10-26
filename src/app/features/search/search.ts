import { Component, effect, inject, OnInit } from '@angular/core';
import { LucideSearch } from '@lucide/angular';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SearchStore } from '../../core/store/search-store';
import { Router } from '@angular/router';

@Component({
  imports: [LucideSearch, ReactiveFormsModule],
  selector: 'app-search',
  styleUrl: './search.css',
  templateUrl: './search.html',
})
export class Search implements OnInit {
  private readonly _formBuilder = inject(FormBuilder);
  private readonly _searchStore = inject(SearchStore);
  private readonly _router = inject(Router);

  public form!: FormGroup<{ query: FormControl<string | null> }>;

  constructor() {
    effect(() => {
      const q = this._searchStore.currentQuery();
      if (this.form && q !== (this.form.controls.query.value ?? '')) {
        this.form.controls.query.setValue(q, { emitEvent: false });
      }
    });
  }

  public ngOnInit(): void {
    this.initForm();
  }

  private initForm(): void {
    this.form = this._formBuilder.group({
      query: [this._searchStore.currentQuery() || '', []],
    });
  }

  public onSubmit(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const query = this.form.value.query?.trim();
    if (!query) {
      return;
    }
    this._searchStore.search(query).subscribe();
    this._router.navigate(['/search'], { queryParams: { q: query } });
  }
}
