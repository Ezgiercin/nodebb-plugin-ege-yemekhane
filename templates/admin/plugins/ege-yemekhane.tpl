<div class="acp-page-container">
	<div class="row m-0">
		<div class="col-12 col-md-8 px-0 mb-4">
			<h4 class="fw-bold">Ege Yemekhane</h4>
			<p class="text-muted">Menüler Ege SKS sayfasından 6 saatte bir otomatik kontrol edilir. Dosya değiştiyse yeniden okunur.</p>
			<table class="table table-sm">
				<tr><th>Son kontrol</th><td>{lastRun}</td></tr>
				<tr><th>Son başarılı kontrol</th><td>{lastSuccess}</td></tr>
				<tr><th>Son güncellenen listeler</th><td>{changed}</td></tr>
			</table>
			{{{ if lastError }}}
			<div class="alert alert-warning"><strong>Hatalar:</strong> {lastError}</div>
			{{{ end }}}
			<button class="btn btn-primary" id="ege-yemekhane-refresh"><i class="fa fa-rotate"></i> Şimdi güncelle</button>
		</div>
	</div>
</div>
