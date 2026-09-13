import { IconButton, Stack, TextField } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import { stepModbusAddress } from '../utils/modbusAddress.mjs'

export default function ModbusAddressField({ value, onChange }) {
  const step = (direction) => onChange(stepModbusAddress(value, direction))

  return (
    <TextField
      type="number"
      size="small"
      value={value ?? ''}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          event.preventDefault()
          step(event.key === 'ArrowUp' ? 1 : -1)
        }
      }}
      fullWidth
      slotProps={{
        htmlInput: { step: 1, 'aria-label': 'Address ID' },
        input: {
          endAdornment: (
            <Stack sx={{ width: 20, flexShrink: 0 }}>
              {[1, -1].map((direction) => (
                <IconButton
                  key={direction}
                  type="button"
                  size="small"
                  aria-label={direction === 1 ? 'เพิ่ม Address ID' : 'ลด Address ID'}
                  title={direction === 1 ? 'เพิ่ม Address ID' : 'ลด Address ID'}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => step(direction)}
                  sx={{ width: 20, height: 16, p: 0, borderRadius: 0 }}
                >
                  <KeyboardArrowDownIcon sx={{ fontSize: 16, transform: direction === 1 ? 'rotate(180deg)' : undefined }} />
                </IconButton>
              ))}
            </Stack>
          ),
        },
      }}
      sx={{
        '& input[type=number]': { MozAppearance: 'textfield' },
        '& input::-webkit-inner-spin-button, & input::-webkit-outer-spin-button': {
          WebkitAppearance: 'none',
          m: 0,
        },
      }}
    />
  )
}
