import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar, Building } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";

export default function DateFilter() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedFloor, setSelectedFloor] = useState("全階");

  const formattedDate = format(selectedDate, "MM月dd日", { locale: ja });

  const handleDateClick = () => {
    // Open date picker - for now just console log
  };

  const handleFloorClick = () => {
    // Open floor selector - for now just console log
  };

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          variant="outline"
          className="date-filter-button"
          onClick={handleDateClick}
        >
          <Calendar className="w-4 h-4 mr-2" />
          <span>{formattedDate}</span>
        </Button>
        <Button
          variant="outline"
          className="date-filter-button"
          onClick={handleFloorClick}
        >
          <Building className="w-4 h-4 mr-2" />
          <span>{selectedFloor}</span>
        </Button>
      </div>
    </div>
  );
}
