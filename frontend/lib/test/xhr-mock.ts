// Just enough XMLHttpRequest for a multipart upload with progress.
export class FakeXhr {
  static last: FakeXhr;
  method = "";
  url = "";
  body = new FormData();
  status = 0;
  upload: { onprogress: ((e: ProgressEvent) => void) | null } = { onprogress: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: FormData) {
    this.body = body;
    FakeXhr.last = this;
  }

  progress(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total } as ProgressEvent);
  }

  finish(status: number) {
    this.status = status;
    this.onload?.();
  }
}
