package com.example.lifeeasy.widgets

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import com.example.lifeeasy.R

class CounterWidgetConfigActivity : AppCompatActivity() {

    private var appWidgetId = AppWidgetManager.INVALID_APPWIDGET_ID
    private val checkBoxesMap = mutableMapOf<String, CheckBox>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(RESULT_CANCELED)
        setContentView(R.layout.activity_counter_widget_config)

        val intent = intent
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

        val container = findViewById<LinearLayout>(R.id.counters_checkbox_container)
        val btnSave = findViewById<Button>(R.id.btn_save_config)

        val counters = WidgetDataStore.getCounters(this)
        val previouslySelected = WidgetDataStore.getSelectedCounterIds(this, appWidgetId)

        if (counters.isEmpty()) {
            val emptyTv = TextView(this).apply {
                text = "No counters found in app! Create counters in LifeEasy first."
                textSize = 14f
                setTextColor(0xFF6B7280.toInt())
                setPadding(0, 20, 0, 20)
            }
            container.addView(emptyTv)
        } else {
            for (counter in counters) {
                val cb = CheckBox(this).apply {
                    text = "${counter.name} (${if (counter.value % 1.0 == 0.0) counter.value.toInt() else counter.value})"
                    textSize = 16f
                    setTextColor(0xFF1F2937.toInt())
                    isChecked = previouslySelected == null || previouslySelected.contains(counter.id)
                    setPadding(12, 16, 12, 16)
                }
                checkBoxesMap[counter.id] = cb
                container.addView(cb)
            }
        }

        btnSave.setOnClickListener {
            val selectedIds = checkBoxesMap.filter { it.value.isChecked }.keys.toSet()
            WidgetDataStore.saveSelectedCounters(this, appWidgetId, selectedIds)

            val resultValue = Intent().apply {
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId)
            }
            setResult(RESULT_OK, resultValue)
            finish()
        }
    }
}
