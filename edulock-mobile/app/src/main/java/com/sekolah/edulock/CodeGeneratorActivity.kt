package com.sekolah.edulock

import android.graphics.Bitmap
import android.graphics.Color
import android.os.Bundle
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.zxing.BarcodeFormat
import com.google.zxing.MultiFormatWriter
import com.google.zxing.WriterException
import com.google.zxing.common.BitMatrix
import java.text.SimpleDateFormat
import java.util.*

class CodeGeneratorActivity : AppCompatActivity() {

    private lateinit var spinnerDuration: Spinner
    private lateinit var btnGenerateCode: Button
    private lateinit var tvGeneratedCode: TextView
    private lateinit var ivQRCode: ImageView
    private lateinit var layoutCodeDisplay: LinearLayout
    private lateinit var tvCodeExpiry: TextView
    private lateinit var btnCopyCode: Button
    private lateinit var recyclerViewCodes: RecyclerView

    private lateinit var codeHelper: CodeHelper
    private lateinit var codesAdapter: ActiveCodesAdapter
    private val activeCodes = mutableListOf<PauseCode>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_code_generator)

        supportActionBar?.title = "Generator Kode Guru"
        supportActionBar?.setDisplayHomeAsUpEnabled(true)

        codeHelper = CodeHelper(this)

        initViews()
        setupSpinner()
        setupButtons()
        setupRecyclerView()
        loadActiveCodes()
    }

    private fun initViews() {
        spinnerDuration = findViewById(R.id.spinnerDuration)
        btnGenerateCode = findViewById(R.id.btnGenerateCode)
        tvGeneratedCode = findViewById(R.id.tvGeneratedCode)
        ivQRCode = findViewById(R.id.ivQRCode)
        layoutCodeDisplay = findViewById(R.id.layoutCodeDisplay)
        tvCodeExpiry = findViewById(R.id.tvCodeExpiry)
        btnCopyCode = findViewById(R.id.btnCopyCode)
        recyclerViewCodes = findViewById(R.id.recyclerViewCodes)
    }

    private fun setupSpinner() {
        val durations = arrayOf(
            "30 Menit",
            "1 Jam",
            "2 Jam",
            "4 Jam",
            "8 Jam (Seharian)"
        )

        val adapter = ArrayAdapter(
            this,
            android.R.layout.simple_spinner_dropdown_item,
            durations
        )
        spinnerDuration.adapter = adapter
        spinnerDuration.setSelection(1) // Default: 1 Jam
    }

    private fun setupButtons() {
        btnGenerateCode.setOnClickListener {
            generateNewCode()
        }

        btnCopyCode.setOnClickListener {
            copyCodeToClipboard()
        }
    }

    private fun setupRecyclerView() {
        codesAdapter = ActiveCodesAdapter(activeCodes) { code ->
            deleteCode(code)
        }
        recyclerViewCodes.layoutManager = LinearLayoutManager(this)
        recyclerViewCodes.adapter = codesAdapter
    }

    private fun generateNewCode() {
        // Generate 6 digit random code
        val code = String.format("%06d", Random().nextInt(1000000))

        // Get duration in minutes
        val durationMinutes = when (spinnerDuration.selectedItemPosition) {
            0 -> 30   // 30 menit
            1 -> 60   // 1 jam
            2 -> 120  // 2 jam
            3 -> 240  // 4 jam
            4 -> 480  // 8 jam
            else -> 60
        }

        val durationSeconds = durationMinutes * 60
        val expiryTime = System.currentTimeMillis() + (durationSeconds * 1000)

        // Save to database
        val codeId = codeHelper.insertCode(code, expiryTime)

        if (codeId > 0) {
            // Display code
            tvGeneratedCode.text = code
            tvCodeExpiry.text = "Berlaku sampai: ${formatDateTime(expiryTime)}"

            // Generate QR Code
            generateQRCode(code)

            // Show layout
            layoutCodeDisplay.visibility = View.VISIBLE

            // Reload active codes list
            loadActiveCodes()

            Toast.makeText(
                this,
                "Kode berhasil dibuat! Berlaku $durationMinutes menit",
                Toast.LENGTH_LONG
            ).show()
        } else {
            Toast.makeText(this, "Gagal membuat kode", Toast.LENGTH_SHORT).show()
        }
    }

    private fun generateQRCode(code: String) {
        try {
            val multiFormatWriter = MultiFormatWriter()
            val bitMatrix: BitMatrix = multiFormatWriter.encode(
                code,
                BarcodeFormat.QR_CODE,
                500,
                500
            )

            val bitmap = Bitmap.createBitmap(500, 500, Bitmap.Config.RGB_565)
            for (x in 0 until 500) {
                for (y in 0 until 500) {
                    bitmap.setPixel(
                        x,
                        y,
                        if (bitMatrix[x, y]) Color.BLACK else Color.WHITE
                    )
                }
            }

            ivQRCode.setImageBitmap(bitmap)
        } catch (e: WriterException) {
            e.printStackTrace()
            Toast.makeText(this, "Gagal generate QR Code", Toast.LENGTH_SHORT).show()
        }
    }

    private fun copyCodeToClipboard() {
        val code = tvGeneratedCode.text.toString()
        val clipboard = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
        val clip = android.content.ClipData.newPlainText("Kode Guru", code)
        clipboard.setPrimaryClip(clip)

        Toast.makeText(this, "Kode disalin: $code", Toast.LENGTH_SHORT).show()
    }

    private fun loadActiveCodes() {
        activeCodes.clear()
        activeCodes.addAll(codeHelper.getActiveCodes())
        codesAdapter.notifyDataSetChanged()

        // Show/hide empty state
        findViewById<TextView>(R.id.tvEmptyState).visibility =
            if (activeCodes.isEmpty()) View.VISIBLE else View.GONE
    }

    private fun deleteCode(code: PauseCode) {
        android.app.AlertDialog.Builder(this)
            .setTitle("Hapus Kode")
            .setMessage("Apakah Anda yakin ingin menghapus kode ${code.code}?")
            .setPositiveButton("Hapus") { _, _ ->
                codeHelper.deleteCode(code.id)
                loadActiveCodes()
                Toast.makeText(this, "Kode dihapus", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Batal", null)
            .show()
    }

    private fun formatDateTime(timestamp: Long): String {
        val sdf = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale("id", "ID"))
        return sdf.format(Date(timestamp))
    }

    override fun onSupportNavigateUp(): Boolean {
        finish()
        return true
    }
}

// Adapter untuk RecyclerView
class ActiveCodesAdapter(
    private val codes: List<PauseCode>,
    private val onDeleteClick: (PauseCode) -> Unit
) : RecyclerView.Adapter<ActiveCodesAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val tvCode: TextView = view.findViewById(R.id.tvCode)
        val tvExpiry: TextView = view.findViewById(R.id.tvExpiry)
        val tvTimeRemaining: TextView = view.findViewById(R.id.tvTimeRemaining)
        val btnDelete: ImageButton = view.findViewById(R.id.btnDelete)
    }

    override fun onCreateViewHolder(parent: android.view.ViewGroup, viewType: Int): ViewHolder {
        val view = android.view.LayoutInflater.from(parent.context)
            .inflate(R.layout.item_active_code, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val code = codes[position]
        holder.tvCode.text = code.code

        val sdf = SimpleDateFormat("dd MMM, HH:mm", Locale("id", "ID"))
        holder.tvExpiry.text = "Expired: ${sdf.format(Date(code.expiryTime))}"

        val remaining = (code.expiryTime - System.currentTimeMillis()) / 1000 / 60
        holder.tvTimeRemaining.text = if (remaining > 0) {
            "Sisa: $remaining menit"
        } else {
            "Kadaluarsa"
        }

        holder.btnDelete.setOnClickListener {
            onDeleteClick(code)
        }
    }

    override fun getItemCount() = codes.size
}