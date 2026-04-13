# Cloud Functions Module - Output Values

output "image_processor_function_name" {
  description = "Name of the image processor Cloud Function"
  value       = google_cloudfunctions2_function.image_processor.name
}

output "image_processor_function_uri" {
  description = "URI of the image processor Cloud Function"
  value       = google_cloudfunctions2_function.image_processor.service_config[0].uri
}

output "image_processor_service_account" {
  description = "Service account email for the image processor"
  value       = google_service_account.image_processor.email
}

output "function_source_bucket" {
  description = "Name of the bucket storing function source code"
  value       = google_storage_bucket.function_source.name
}
