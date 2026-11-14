package com.example.lifeeasy.widgets

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.Spinner
import androidx.appcompat.app.AppCompatActivity
import com.example.lifeeasy.R

class ChecklistWidgetConfigActivity : AppCompatActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)
        setContentView(R.layout.activity_checklist_widget_config)

        val extras = intent.extras
        if (extras != null) {
            appWidgetId = extras.getInt(
                AppWidgetManager.EXTRA_APPWIDGET_ID,
                AppWidgetManager.INVALID_APPWIDGET_ID
            )
        }

        if (appWidgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }

        val spinner = findViewById<Spinner>(R.id.category_spinner)
        val btnSave = findViewById<Button>(R.id.btn_save_checklist_config)

        val categories = WidgetDataStore.getAvailableTaskCategories(this)
        val adapter = ArrayAdapter(this, android.R.layout.simple_spinner_item, categories).apply {
            setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        }
        spinner.adapter = adapter

        val currentTag = WidgetDataStore.getSelectedChecklistTag(this, appWidgetId)
        if (currentTag != null) {
            val idx = categories.indexOf(currentTag)
            if (idx >= 0) spinner.setSelection(idx)
        }

        btnSave.setOnClickListener {
            val selectedTag = spinner.selectedItem?.toString() ?: "All"
            WidgetDataStore.saveSelectedChecklistTag(this, appWidgetId, if (selectedTag == "All") null else selectedTag)

            val resultValue = Intent().apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            }
            setResult(RESULT_OK, resultValue)
            finish()
        }
    }
}
