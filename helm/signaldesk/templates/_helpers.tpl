{{- define "signaldesk.fullname" -}}
{{- .Release.Name -}}
{{- end -}}

{{- define "signaldesk.imageTag" -}}
{{- $tag := required "Set global.imageTag to a published 40-character Git commit SHA" .Values.global.imageTag -}}
{{- if not (regexMatch "^[0-9a-f]{40}$" $tag) -}}
{{- fail "global.imageTag must be a lowercase 40-character Git commit SHA" -}}
{{- end -}}
{{- $tag -}}
{{- end -}}
